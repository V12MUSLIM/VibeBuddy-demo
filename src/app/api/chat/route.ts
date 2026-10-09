import { ApiError, GoogleGenAI } from "@google/genai";

const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 20_000;
const MAX_ATTACHMENTS = 10;
const MAX_FILENAME_LENGTH = 255;

type ChatMessageInput = {
  role: "user" | "agent";
  content: string;
  attachments?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateMessages(
  value: unknown,
): { messages: ChatMessageInput[] } | { error: string } {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_MESSAGES
  ) {
    return {
      error: `messages must contain between 1 and ${MAX_MESSAGES} items.`,
    };
  }

  const messages: ChatMessageInput[] = [];

  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) {
      return { error: `messages[${index}] must be an object.` };
    }

    if (item.role !== "user" && item.role !== "agent") {
      return { error: `messages[${index}].role must be "user" or "agent".` };
    }

    if (
      typeof item.content !== "string" ||
      item.content.length > MAX_MESSAGE_LENGTH
    ) {
      return {
        error: `messages[${index}].content must be a string no longer than ${MAX_MESSAGE_LENGTH} characters.`,
      };
    }

    let attachments: string[] | undefined;
    if (item.attachments !== undefined) {
      if (
        !Array.isArray(item.attachments) ||
        item.attachments.length > MAX_ATTACHMENTS ||
        !item.attachments.every(
          (name) =>
            typeof name === "string" &&
            name.length > 0 &&
            name.length <= MAX_FILENAME_LENGTH,
        )
      ) {
        return {
          error: `messages[${index}].attachments must be an array of up to ${MAX_ATTACHMENTS} filenames, each no longer than ${MAX_FILENAME_LENGTH} characters.`,
        };
      }
      attachments = item.attachments;
    }

    if (
      item.content.trim().length === 0 &&
      (!attachments || attachments.length === 0)
    ) {
      return {
        error: `messages[${index}] must contain text or at least one attachment.`,
      };
    }

    messages.push({ role: item.role, content: item.content, attachments });
  }

  return { messages };
}

export async function POST(request: Request) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim();
  if (contentType !== "application/json") {
    return Response.json(
      { error: "Content-Type must be application/json." },
      { status: 415 },
    );
  }

  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
    return Response.json(
      { error: "Request body is too large." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!isRecord(body)) {
    return Response.json(
      { error: "Request body must be an object." },
      { status: 400 },
    );
  }

  const result = validateMessages(body.messages);
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const chunks = await ai.models.generateContentStream({
      model: "gemini-2.5-flash-lite",
      contents: result.messages.map((msg) => ({
        role: msg.role === "agent" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
    });
    const textStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of chunks) {
            const text = chunk.text ?? "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
    return new Response(textStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      return Response.json(
        { error: "Gemini rate limit reached. Please try again shortly." },
        { status: 429 },
      );
    }

    if (error instanceof ApiError && error.status === 503) {
      return Response.json(
        {
          error: "Gemini is temporarily unavailable. Please try again shortly.",
        },
        { status: 503 },
      );
    }

    console.error("Gemini request failed:", error);
    return Response.json({ error: "Gemini request failed." }, { status: 500 });
  }
}
