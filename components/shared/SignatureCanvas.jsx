import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Check } from 'lucide-react';

export default function SignatureCanvas({ value, onChange, placeholder = 'Firme aquí', disabled = false }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!value);
  const lastPos = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // If we have a saved value (dataURL), restore it
    if (value && value.startsWith('data:')) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = value;
      setHasSignature(true);
    }
  }, []);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    if (disabled) return;
    e.preventDefault();
    setDrawing(true);
    const canvas = canvasRef.current;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e) => {
    if (!drawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasSignature(true);
  };

  const stopDraw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    setDrawing(false);
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onChange('');
  };

  return (
    <div className="space-y-2">
      <div className={`relative border-2 rounded-xl overflow-hidden transition-all ${
        disabled ? 'opacity-60 bg-muted/30 border-border' : 'border-primary/30 bg-white hover:border-primary/60'
      }`}>
        {!hasSignature && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted-foreground text-sm font-medium">{placeholder}</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full h-[120px] cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
      {!disabled && (
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">Dibuje su firma con el mouse o dedo</p>
          <Button type="button" variant="ghost" size="sm" onClick={clear} className="h-7 px-2 text-xs gap-1">
            <RotateCcw className="w-3 h-3" />Limpiar
          </Button>
        </div>
      )}
      {hasSignature && disabled && (
        <div className="flex items-center gap-1.5 text-emerald-600">
          <Check className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Firma registrada</span>
        </div>
      )}
    </div>
  );
}