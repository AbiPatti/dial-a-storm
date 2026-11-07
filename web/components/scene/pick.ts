import type { ThreeEvent } from "@react-three/fiber";
import { useDialStore, type SceneObject } from "@/lib/store";

/**
 * Pointer handlers that make a mesh selectable: hover highlights, click selects (opens its info
 * panel), double-click selects and flies the camera to it. Handlers only touch the store; the
 * scene reads the result in useFrame, so no React state changes inside the render loop.
 */
export function pickHandlers(object: SceneObject) {
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      useDialStore.getState().hover(object);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      if (useDialStore.getState().hovered === object) useDialStore.getState().hover(null);
      document.body.style.cursor = "";
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      useDialStore.getState().select(object);
    },
    onDoubleClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const s = useDialStore.getState();
      s.select(object);
      s.focusOn(object);
    },
  };
}
