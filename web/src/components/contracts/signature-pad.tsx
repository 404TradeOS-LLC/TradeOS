"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface SignaturePadProps {
  inputName: string;
}

export function SignaturePad({ inputName }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureValue, setSignatureValue] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentCanvas = canvas;

    const context = currentCanvas.getContext("2d");
    if (!context) return;
    const currentContext = context;

    currentContext.lineWidth = 2;
    currentContext.lineCap = "round";
    currentContext.strokeStyle = "#0f172a";

    let drawing = false;

    function pointFromEvent(event: PointerEvent) {
      const rect = currentCanvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }

    function start(event: PointerEvent) {
      drawing = true;
      const point = pointFromEvent(event);
      currentContext.beginPath();
      currentContext.moveTo(point.x, point.y);
    }

    function move(event: PointerEvent) {
      if (!drawing) return;
      const point = pointFromEvent(event);
      currentContext.lineTo(point.x, point.y);
      currentContext.stroke();
      setHasSignature(true);
      setSignatureValue(currentCanvas.toDataURL("image/png"));
    }

    function end() {
      drawing = false;
    }

    currentCanvas.addEventListener("pointerdown", start);
    currentCanvas.addEventListener("pointermove", move);
    currentCanvas.addEventListener("pointerup", end);
    currentCanvas.addEventListener("pointerleave", end);

    return () => {
      currentCanvas.removeEventListener("pointerdown", start);
      currentCanvas.removeEventListener("pointermove", move);
      currentCanvas.removeEventListener("pointerup", end);
      currentCanvas.removeEventListener("pointerleave", end);
    };
  }, []);

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} width={560} height={180} className="w-full rounded-xl border border-border/70 bg-white" />
      <input type="hidden" name={inputName} value={hasSignature ? signatureValue : ""} readOnly />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const canvas = canvasRef.current;
            const context = canvas?.getContext("2d");
            if (!canvas || !context) return;
            context.clearRect(0, 0, canvas.width, canvas.height);
            setHasSignature(false);
            setSignatureValue("");
          }}
        >
          Clear signature
        </Button>
      </div>
    </div>
  );
}
