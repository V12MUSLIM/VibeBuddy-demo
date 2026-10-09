"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NOTIF_BLUE } from "./bot/decor";
import { BotEngine, type BotFrame, type Look } from "./bot/engine";
import { clamp, easings } from "./bot/math";
import {
  DEFAULT_EXPRESSION,
  EXPRESSION_BY_ID,
  type ExpressionId,
} from "./bot/expressions";
import {
  COLOR_BY_ID,
  DEFAULT_COLOR,
  DEFAULT_SHAPE,
  SHAPE_BY_ID,
  mixHex,
  type ColorId,
  type ShapeId,
} from "./bot/skins";
import { blockAt, defaultCycle, offsetOf, type Block } from "./bot/cycles";
import { DEMI_VIEWBOX, RAYON } from "./bot/repere";
import { STATE_BY_ID, type StateId } from "./bot/states";

const SCRIPT_MORPH = 1 / 60;
const TURN_TIME = 1.1;
const DEFAULT_CYCLE = defaultCycle().blocks;

export type GazeScript = (elapsed: number) => Look;
export type HexColor = `#${string}`;

export interface BloubHandle {
  /** Seek to a block and an optional offset, in seconds. */
  seek: (index: number, offset?: number) => void;
  /** Render the cycle at an absolute time without starting the animation loop. */
  rendAt: (time: number) => void;
}

export interface BloubProps {
  /** Rendered SVG width and height in CSS pixels. Default: `320`. */
  size?: number;
  /** Base silhouette preset ID from `SHAPES`. Default: `"cercle"`. */
  shape?: ShapeId;
  /** Body ink preset ID from `COLORS`. Default: `"encre"`. */
  color?: ColorId;
  /** Resting face preset ID from `EXPRESSIONS`. Default: `"neutre"`. */
  expression?: ExpressionId;
  /** Background color used for the eye cutouts and particle depth blending. Default: `"#f9f9f9"`. */
  paper?: HexColor;
  /** Freeze the animation and render this time in seconds. Omit to animate. */
  frozenAt?: number;
  /** Ordered animation blocks used by the player. Defaults to the built-in cycle. */
  cycle?: Block[];
  /** Make the avatar follow the mouse pointer. Default: `false`. */
  follow?: boolean;
  /** Scripted gaze as a function of elapsed seconds; takes priority when `follow` is false. */
  gaze?: GazeScript | null;
  /** Current avatar state. When provided, state changes are reported through `onStateChange`. */
  state?: StateId;
  /** Called when playback or a seek changes the current avatar state. */
  onStateChange?: (state: StateId) => void;
  /** Zero-based current block in `cycle`. Default: `0`. */
  block?: number;
  /** Called when playback or a seek moves to another block. */
  onBlockChange?: (block: number) => void;
  /** Whether the cycle is playing. Default: `false`. */
  playing?: boolean;
  /** Elapsed time in seconds within the current block. Default: `0`. */
  elapsed?: number;
  /** Called as playback advances the elapsed time in the current block. */
  onElapsedChange?: (elapsed: number) => void;
  /** Additional CSS classes applied to the root SVG. */
  className?: string;
}

const Bloub = forwardRef<BloubHandle, BloubProps>(function Bloub(
  {
    size = 320,
    shape = DEFAULT_SHAPE,
    color = DEFAULT_COLOR,
    expression = DEFAULT_EXPRESSION,
    paper = "#f9f9f9",
    frozenAt,
    cycle = DEFAULT_CYCLE,
    follow = false,
    gaze = null,
    state,
    onStateChange,
    block,
    onBlockChange,
    playing,
    elapsed,
    onElapsedChange,
    className,
  },
  ref,
) {
  const initialState = state ?? "idle";
  const engineRef = useRef<BotEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new BotEngine(
      RAYON,
      initialState,
      SHAPE_BY_ID.get(shape)?.radii ?? null,
      EXPRESSION_BY_ID.get(expression) ?? null,
    );
  }
  const engine = engineRef.current;

  const [internalState, setInternalState] = useState(initialState);
  const [internalBlock, setInternalBlock] = useState(0);
  const [internalElapsed, setInternalElapsed] = useState(0);
  const currentBlock = block ?? internalBlock;
  const isPlaying = playing ?? false;
  const currentElapsed = elapsed ?? internalElapsed;

  const timeRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const blockStartRef = useRef(0);
  const nextAtRef = useRef(Number.POSITIVE_INFINITY);
  const previousRenderedBlockRef = useRef(-1);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const aimingRef = useRef(false);
  const turnSinceRef = useRef(0);
  const gazeSinceRef = useRef(0);
  const gazeRef = useRef(gaze);
  const propsRef = useRef({ cycle, follow, playing: isPlaying, state: state ?? internalState });
  const svgRef = useRef<SVGSVGElement>(null);
  const cycleRef = useRef(cycle);
  const playingRef = useRef(isPlaying);
  const elapsedRef = useRef(currentElapsed);

  cycleRef.current = cycle;
  playingRef.current = isPlaying;
  elapsedRef.current = currentElapsed;
  gazeRef.current = gaze;
  propsRef.current = { cycle, follow, playing: isPlaying, state: state ?? internalState };

  const [frame, setFrame] = useState<BotFrame>(() => engine.sample(frozenAt ?? 0));
  const maskId = `bloub-mask-${useId().replace(/:/g, "")}`;
  const ink = COLOR_BY_ID.get(color)?.hex ?? "#0a0a0c";

  const updateState = useCallback(
    (nextState: StateId, now = timeRef.current) => {
      if (engine.state !== nextState) engine.setState(nextState, now);
      setInternalState(nextState);
      onStateChange?.(nextState);
    },
    [engine, onStateChange],
  );

  const updateBlock = useCallback(
    (nextBlock: number) => {
      setInternalBlock(nextBlock);
      onBlockChange?.(nextBlock);
    },
    [onBlockChange],
  );

  const updateElapsed = useCallback(
    (nextElapsed: number) => {
      setInternalElapsed(nextElapsed);
      onElapsedChange?.(nextElapsed);
    },
    [onElapsedChange],
  );

  const applyBlock = useCallback(
    (index: number, from = 0) => {
      const activeCycle = cycleRef.current;
      const current = activeCycle[index];
      if (!current) {
        nextAtRef.current = Number.POSITIVE_INFINITY;
        return;
      }

      blockStartRef.current = timeRef.current - from;
      updateElapsed(from);
      updateState(current.state);
      nextAtRef.current = playingRef.current
        ? blockStartRef.current + current.duration
        : Number.POSITIVE_INFINITY;
    },
    [updateElapsed, updateState],
  );

  const goToBlock = useCallback(
    (index: number) => {
      updateBlock(index);
      applyBlock(index);
    },
    [applyBlock, updateBlock],
  );

  const seek = useCallback(
    (index: number, offset = 0) => {
      if (index === currentBlock) {
        applyBlock(index, offset);
        return;
      }
      updateBlock(index);
      applyBlock(index, offset);
    },
    [applyBlock, currentBlock, updateBlock],
  );

  const rendAt = useCallback(
    (time: number) => {
      const activeCycle = cycleRef.current;
      if (!activeCycle.length) return;

      const { index } = blockAt(activeCycle, time);
      if (index !== previousRenderedBlockRef.current) {
        const current = activeCycle[index];
        if (!current) return;
        const offset = offsetOf(activeCycle, index);
        setInternalState(current.state);
        onStateChange?.(current.state);
        if (index < previousRenderedBlockRef.current) engine.reset(current.state, offset);
        else engine.setState(current.state, offset);
        previousRenderedBlockRef.current = index;
      }
      setFrame(engine.sample(time));
    },
    [engine, onStateChange],
  );

  useImperativeHandle(ref, () => ({ seek, rendAt }), [rendAt, seek]);

  useEffect(() => {
    if (state === undefined || state === engine.state) return;
    engine.setState(state, timeRef.current);
    setInternalState(state);
    if (frozenAt !== undefined) setFrame(engine.sample(frozenAt));
  }, [engine, frozenAt, state]);

  useEffect(() => {
    engine.setShape(SHAPE_BY_ID.get(shape)?.radii ?? null, timeRef.current);
    if (frozenAt !== undefined) setFrame(engine.sample(frozenAt));
  }, [engine, frozenAt, shape]);

  useEffect(() => {
    engine.setExpression(EXPRESSION_BY_ID.get(expression) ?? null, timeRef.current);
    if (frozenAt !== undefined) setFrame(engine.sample(frozenAt));
  }, [engine, expression, frozenAt]);

  useEffect(() => {
    if (block !== undefined && block !== internalBlock) {
      applyBlock(block);
    }
  }, [applyBlock, block, internalBlock]);

  useEffect(() => {
    if (playing === undefined) return;
    if (playing) applyBlock(currentBlock, elapsedRef.current);
    else nextAtRef.current = Number.POSITIVE_INFINITY;
  }, [applyBlock, currentBlock, playing]);

  useEffect(() => {
    if (!cycle.length) {
      nextAtRef.current = Number.POSITIVE_INFINITY;
      return;
    }
    const index = Math.min(currentBlock, cycle.length - 1);
    if (index !== currentBlock) {
      updateBlock(index);
      applyBlock(index);
      return;
    }
    const current = cycle[index];
    if (current && playingRef.current) {
      nextAtRef.current = blockStartRef.current + current.duration;
    }
  }, [applyBlock, cycle, currentBlock, updateBlock]);

  useEffect(() => {
    engine.setLook(null, timeRef.current);
    aimingRef.current = false;
    gazeSinceRef.current = timeRef.current;
    if (gaze) engine.setLook(gaze(0), timeRef.current - SCRIPT_MORPH, SCRIPT_MORPH);
  }, [engine, gaze]);

  useEffect(() => {
    if (!follow || frozenAt !== undefined) {
      pointerRef.current = null;
      if (aimingRef.current) engine.setLook(null, timeRef.current, TURN_TIME);
      aimingRef.current = false;
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        pointerRef.current = { x: event.clientX, y: event.clientY };
      }
    };
    const onPointerLeave = () => {
      pointerRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerleave", onPointerLeave);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [engine, follow, frozenAt]);

  useEffect(() => {
    if (frozenAt !== undefined) {
      setFrame(engine.sample(frozenAt));
      return;
    }

    let animationFrame = 0;
    const tick = (milliseconds: number) => {
      animationFrame = requestAnimationFrame(tick);
      const previous = lastTimeRef.current;
      const delta = previous === null ? 0 : Math.min((milliseconds - previous) / 1000, 0.064);
      lastTimeRef.current = milliseconds;
      timeRef.current += delta;
      const now = timeRef.current;
      const active = propsRef.current;
      const activeCycle = active.cycle;

      if (active.playing && activeCycle.length) {
        if (now >= nextAtRef.current) {
          goToBlock((currentBlock + 1) % activeCycle.length);
        } else {
          updateElapsed(now - blockStartRef.current);
        }
      }

      if (active.follow && STATE_BY_ID.get(active.state)?.baseFace) {
        const bounds = svgRef.current?.getBoundingClientRect();
        if (bounds && bounds.width > 0 && bounds.height > 0) {
          if (!aimingRef.current) turnSinceRef.current = now;
          const pointer = pointerRef.current;
          const halfWidth = Math.max(1, window.innerWidth / 2);
          const halfHeight = Math.max(1, window.innerHeight / 2);
          const nx = pointer
            ? clamp((pointer.x - (bounds.left + bounds.width / 2)) / halfWidth, -1, 1)
            : 0;
          const ny = pointer
            ? clamp((pointer.y - (bounds.top + bounds.height / 2)) / halfHeight, -1, 1)
            : 0;
          engine.setLook(
            {
              yaw: nx * 26,
              pitch: -ny * 16,
              mix: 1,
              spin: easings.easeOutQuint(clamp((now - turnSinceRef.current) / TURN_TIME)) * 360,
              wander: pointer ? 0 : 1,
            },
            now,
          );
          aimingRef.current = true;
        }
      } else if (active.follow && aimingRef.current) {
        engine.setLook(null, now, TURN_TIME);
        aimingRef.current = false;
      } else if (!active.follow && gazeRef.current) {
        engine.setLook(gazeRef.current(now - gazeSinceRef.current), now, SCRIPT_MORPH);
      }

      setFrame(engine.sample(now));
    };

    animationFrame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrame);
      lastTimeRef.current = null;
    };
  }, [currentBlock, engine, frozenAt, goToBlock, updateElapsed]);

  function renderDot(dot: BotFrame["dots"][number], key: string): ReactNode {
    const fill = dot.color ?? (dot.depth === undefined ? ink : mixHex(paper, ink, dot.depth));
    if (dot.d) {
      return (
        <path
          key={key}
          d={dot.d}
          transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${RAYON})`}
          fill={fill}
          opacity={dot.opacity}
        />
      );
    }
    return <circle key={key} cx={dot.x} cy={dot.y} r={dot.r} fill={fill} opacity={dot.opacity} />;
  }

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`${-DEMI_VIEWBOX} ${-DEMI_VIEWBOX} ${DEMI_VIEWBOX * 2} ${DEMI_VIEWBOX * 2}`}
      className={className}
      role="img"
      aria-label="AI avatar"
    >
      <defs>
        {frame.arcs.map((arc) => (
          <linearGradient
            key={arc.id}
            id={`${maskId}-${arc.id}`}
            gradientUnits="userSpaceOnUse"
            x1={arc.grad.x1}
            y1={arc.grad.y1}
            x2={arc.grad.x2}
            y2={arc.grad.y2}
          >
            {arc.grad.stops.map((stop, index) => (
              <stop
                key={index}
                offset={index / Math.max(1, arc.grad.stops.length - 1)}
                stopColor={stop}
              />
            ))}
          </linearGradient>
        ))}
      </defs>

      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path
            key={`back-${arc.id}`}
            d={arc.back}
            stroke={`url(#${maskId}-${arc.id})`}
            strokeWidth={arc.width}
            opacity={arc.opacity}
          />
        ))}
      </g>

      {frame.dotsBehind && (
        <g>
          {frame.dots.map((dot, index) => renderDot(dot, `behind-${index}`))}
        </g>
      )}

      <g opacity={frame.bodyAlpha}>
        <path d={frame.bodyPath} fill={ink} />
        {frame.notch && (
          <circle
            cx={frame.notch.x}
            cy={frame.notch.y}
            r={frame.notch.r}
            fill={paper}
          />
        )}
        {frame.eyes.map((eye, index) => (
          <path
            key={index}
            d={eye.d}
            transform={eye.matrix}
            opacity={eye.alpha}
            fill={paper}
          />
        ))}
      </g>

      {!frame.dotsBehind && (
        <g>
          {frame.dots.map((dot, index) => renderDot(dot, `front-${index}`))}
        </g>
      )}

      {frame.notif && (
        <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill={NOTIF_BLUE} />
      )}

      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path
            key={`front-${arc.id}`}
            d={arc.front}
            stroke={`url(#${maskId}-${arc.id})`}
            strokeWidth={arc.width}
            opacity={arc.opacity}
          />
        ))}
      </g>

    </svg>
  );
});

export default Bloub;
