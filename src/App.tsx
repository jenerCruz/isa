/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Stage, 
  Layer, 
  Rect, 
  Image as KonvaImage, 
  Group, 
  Transformer,
  Line,
  Circle,
  Text
} from 'react-konva';
import { 
  Plus, 
  Download, 
  Smartphone, 
  Image as ImageIcon, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Trash2,
  Maximize,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Settings2,
  Printer,
  Eye,
  FileText,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PHONE_MODELS, MM_TO_PX, MM_TO_PX_EXPORT } from './constants';
import { PhoneModel, DesignImage } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { jsPDF } from 'jspdf';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const URLImage = ({ image, isSelected, onSelect, onChange }: { 
  image: DesignImage, 
  isSelected: boolean, 
  onSelect: () => void,
  onChange: (newAttrs: Partial<DesignImage>) => void 
}) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = image.src;
    img.onload = () => {
      setImgObj(img);
    };
    img.onerror = () => {
      console.error("Failed to load image:", image.src);
    };
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [image.src]);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  if (!imgObj) return null;

  return (
    <React.Fragment>
      <KonvaImage
        image={imgObj}
        onClick={onSelect}
        onTap={onSelect}
        ref={shapeRef}
        {...image}
        draggable
        onDragEnd={(e) => {
          onChange({
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          
          // Reset node scales to 1 and update width/height in state
          node.scaleX(1);
          node.scaleY(1);
          
          onChange({
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
            rotation: node.rotation(),
            scaleX: 1,
            scaleY: 1,
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </React.Fragment>
  );
};

export default function App() {
  const [selectedModel, setSelectedModel] = useState<PhoneModel>(PHONE_MODELS[0]);
  const [images, setImages] = useState<DesignImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bleedMm, setBleedMm] = useState(3);
  const [showSafeLines, setShowSafeLines] = useState(true);
  const [show3DPreview, setShow3DPreview] = useState(false);
  const stageRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');

  const selectedImage = images.find(img => img.id === selectedId);

  const updateSelectedImage = (attrs: Partial<DesignImage>) => {
    if (!selectedId) return;
    setImages(prev => prev.map(img => img.id === selectedId ? { ...img, ...attrs } : img));
  };

  const filteredModels = PHONE_MODELS.filter(model => 
    model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new window.Image();
        img.src = reader.result as string;
        img.onload = () => {
          const MAX_SIZE = 2000;
          let width = img.width;
          let height = img.height;

          if (width > MAX_SIZE || height > MAX_SIZE) {
            const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
            width = width * ratio;
            height = height * ratio;
          }

          const newImage: DesignImage = {
            id: Math.random().toString(36).substr(2, 9),
            src: reader.result as string,
            x: 50,
            y: 50,
            width: width / 4,
            height: height / 4,
            originalWidth: img.width,
            originalHeight: img.height,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          };
          setImages(prev => [...prev, newImage]);
          setSelectedId(newImage.id);
          // Reset file input value
          e.target.value = '';
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const calculateDPI = (image: DesignImage) => {
    // mm = image.width / MM_TO_PX
    // DPI = originalWidth / (mm / 25.4)
    // Since MM_TO_PX = 96 / 25.4, then mm / 25.4 = image.width / 96
    const dpiX = (image.originalWidth / image.width) * 96;
    const dpiY = (image.originalHeight / image.height) * 96;
    return Math.min(dpiX, dpiY);
  };

  const getQualityLabel = (dpi: number) => {
    if (dpi >= 300) return { label: 'Excelente', color: 'text-green-600 bg-green-50' };
    if (dpi >= 200) return { label: 'Aceptable', color: 'text-yellow-600 bg-yellow-50' };
    return { label: 'Baja', color: 'text-red-600 bg-red-50' };
  };

  const [isExporting, setIsExporting] = useState(false);

  const exportImage = (format: 'png' | 'jpg' | 'pdf') => {
    const stage = stageRef.current;
    if (!stage) return;

    setIsExporting(true);
    // Deselect everything for export
    setSelectedId(null);
    
    // Use requestAnimationFrame for better state synchronization
    requestAnimationFrame(() => {
      // Wait another frame to be extra sure React has rendered the deselection
      requestAnimationFrame(() => {
        try {
          // Force a draw to ensure guides are hidden and state is reflected
          stage.draw();

          const totalWidthMm = selectedModel.widthMm + (bleedMm * 2);
          const totalHeightMm = selectedModel.heightMm + (bleedMm * 2);
          const pixelRatio = MM_TO_PX_EXPORT / MM_TO_PX;
          const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
          
          // Calculate expected dimensions in pixels for 300 DPI
          const expectedWidthPx = Math.round(totalWidthMm * MM_TO_PX_EXPORT);
          const expectedHeightPx = Math.round(totalHeightMm * MM_TO_PX_EXPORT);
          
          console.log(`Exporting ${format.toUpperCase()} at 300 DPI: ${expectedWidthPx}x${expectedHeightPx}px (${totalWidthMm}x${totalHeightMm}mm)`);

          // Use toBlob for better reliability with large images
          stage.toBlob({
            pixelRatio: pixelRatio,
            mimeType: mimeType,
            quality: 0.95, // High quality but slightly compressed for JPG
            callback: (blob) => {
              if (!blob) {
                setIsExporting(false);
                alert('Error al generar el archivo de imagen.');
                return;
              }

              if (format === 'pdf') {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64data = reader.result as string;
                  const totalWidthMm = selectedModel.widthMm + (bleedMm * 2);
                  const totalHeightMm = selectedModel.heightMm + (bleedMm * 2);
                  const orientation = totalWidthMm > totalHeightMm ? 'l' : 'p';
                  
                  const pdf = new jsPDF({
                    orientation: orientation,
                    unit: 'mm',
                    format: [totalWidthMm, totalHeightMm],
                    compress: true,
                    precision: 2
                  });
                  
                  pdf.addImage(base64data, 'PNG', 0, 0, totalWidthMm, totalHeightMm, undefined, 'FAST');
                  pdf.save(`${selectedModel.name}-300dpi.pdf`);
                  setIsExporting(false);
                };
                reader.readAsDataURL(blob);
              } else {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `${selectedModel.name}-300dpi.${format}`;
                link.href = url;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Cleanup the URL object
                setTimeout(() => {
                  URL.revokeObjectURL(url);
                  setIsExporting(false);
                }, 100);
              }
            }
          });
        } catch (error) {
          console.error('Export failed:', error);
          alert('Error al exportar la imagen. Por favor, intenta de nuevo. Detalles: ' + (error instanceof Error ? error.message : 'Error desconocido'));
          setIsExporting(false);
        }
      });
    });
  };

  const canvasWidth = (selectedModel.widthMm + (bleedMm * 2)) * MM_TO_PX;
  const canvasHeight = (selectedModel.heightMm + (bleedMm * 2)) * MM_TO_PX;

  return (
    <div className="flex h-screen bg-[#F5F5F4] text-[#141414] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-[#141414]/10 transition-all duration-300 flex flex-col",
        sidebarOpen ? "w-80" : "w-0 overflow-hidden"
      )}>
        <div className="p-6 border-b border-[#141414]/10 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">SkinDesigner Pro</h1>
          <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-black/5 rounded">
            <ChevronLeft size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-black/40 mb-4 flex items-center gap-2">
              <Smartphone size={14} /> Modelos de Teléfono
            </h2>
            <div className="mb-4">
              <input 
                type="text" 
                placeholder="Buscar modelo..." 
                className="w-full px-3 py-2 bg-black/5 border border-transparent focus:border-[#141414]/20 rounded-lg text-sm outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              {filteredModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group",
                    selectedModel.id === model.id 
                      ? "bg-[#141414] text-white border-[#141414]" 
                      : "bg-white border-[#141414]/10 hover:border-[#141414]/30"
                  )}
                >
                  <div>
                    <div className="font-medium">{model.name}</div>
                    <div className={cn("text-xs", selectedModel.id === model.id ? "text-white/60" : "text-black/40")}>
                      {model.widthMm} × {model.heightMm} mm
                    </div>
                  </div>
                  <ChevronRight size={16} className={cn("transition-transform", selectedModel.id === model.id ? "translate-x-1" : "opacity-0 group-hover:opacity-100")} />
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-black/40 mb-4 flex items-center gap-2">
              <Settings2 size={14} /> Ajustes de Impresión
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-black/5 rounded-xl space-y-2">
                <div className="text-sm font-medium">Resolución de Exportación</div>
                <div className="text-xs text-black/60">300 DPI (Calidad Profesional)</div>
              </div>
              <div className="p-4 bg-black/5 rounded-xl space-y-2">
                <div className="text-sm font-medium">Dimensiones Reales</div>
                <div className="text-xs text-black/60">{selectedModel.widthMm}mm x {selectedModel.heightMm}mm</div>
              </div>
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-[#141414]/10">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-[#141414] text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-black/90 transition-colors"
          >
            <Plus size={20} /> Importar Imagen
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            className="hidden" 
            accept="image/*"
          />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {!sidebarOpen && (
          <button 
            onClick={() => setSidebarOpen(true)}
            className="absolute left-4 top-4 z-10 p-2 bg-white border border-[#141414]/10 rounded-xl shadow-sm hover:bg-black/5"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Toolbar */}
        <div className="h-16 bg-white border-b border-[#141414]/10 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex bg-black/5 p-1 rounded-lg">
              <button 
                onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
                className="p-1.5 hover:bg-white rounded-md transition-colors"
              >
                <ZoomOut size={18} />
              </button>
              <div className="px-3 flex items-center text-sm font-medium min-w-[60px] justify-center">
                {Math.round(zoom * 100)}%
              </div>
              <button 
                onClick={() => setZoom(prev => Math.min(5, prev + 0.1))}
                className="p-1.5 hover:bg-white rounded-md transition-colors"
              >
                <ZoomIn size={18} />
              </button>
            </div>
            <button 
              onClick={() => {
                setZoom(1);
                setImages([]);
                setSelectedId(null);
              }}
              className="p-2 hover:bg-black/5 rounded-lg transition-colors text-black/60 hover:text-black"
              title="Resetear diseño"
            >
              <RotateCcw size={18} />
            </button>
            {selectedId && (
              <button 
                onClick={() => {
                  setImages(images.filter(img => img.id !== selectedId));
                  setSelectedId(null);
                }}
                className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-500"
                title="Eliminar imagen"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => exportImage('jpg')}
              disabled={isExporting}
              className={cn(
                "bg-[#141414] text-white px-4 py-2 rounded-l-lg font-medium flex items-center gap-2 transition-colors border-r border-white/10",
                isExporting ? "opacity-50 cursor-not-allowed" : "hover:bg-black/90"
              )}
            >
              <Download size={18} /> {isExporting ? 'Exportando...' : 'Exportar JPG'}
            </button>
            <div className="dropdown relative group">
              <button 
                disabled={isExporting}
                className={cn(
                  "bg-[#141414] text-white px-2 py-2 rounded-r-lg font-medium flex items-center justify-center transition-colors",
                  isExporting ? "opacity-50 cursor-not-allowed" : "hover:bg-black/90"
                )}
              >
                <ChevronDown size={18} />
              </button>
              <div className={cn(
                "absolute right-0 top-full mt-2 w-48 bg-white border border-[#141414]/10 rounded-xl shadow-xl transition-all z-20",
                isExporting ? "opacity-0 invisible" : "opacity-0 invisible group-hover:opacity-100 group-hover:visible"
              )}>
                <button onClick={() => exportImage('jpg')} className="w-full text-left px-4 py-3 hover:bg-black/5 rounded-t-xl text-sm font-medium">JPG (300 DPI)</button>
                <button onClick={() => exportImage('png')} className="w-full text-left px-4 py-3 hover:bg-black/5 text-sm font-medium">PNG (300 DPI)</button>
                <button onClick={() => exportImage('pdf')} className="w-full text-left px-4 py-3 hover:bg-black/5 rounded-b-xl text-sm font-medium">PDF (Escala Real)</button>
              </div>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto flex flex-col items-center justify-center p-12 bg-[#E4E3E0] pattern-grid relative">
          <AnimatePresence>
            {isExporting && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
              >
                <div className="w-12 h-12 border-4 border-[#141414] border-t-transparent rounded-full animate-spin"></div>
                <div className="text-sm font-bold uppercase tracking-widest animate-pulse">Procesando Exportación 300 DPI...</div>
                <div className="text-xs text-black/40">Esto puede tardar unos segundos debido a la alta resolución</div>
              </motion.div>
            )}
          </AnimatePresence>

          <div 
            className="relative shadow-2xl bg-white"
            style={{ 
              width: canvasWidth, 
              height: canvasHeight,
              transform: `scale(${zoom})`,
              transformOrigin: 'center center'
            }}
          >
            <Stage
              width={canvasWidth}
              height={canvasHeight}
              ref={stageRef}
              onMouseDown={(e) => {
                const clickedOnEmpty = e.target === e.target.getStage();
                if (clickedOnEmpty) {
                  setSelectedId(null);
                }
              }}
            >
              <Layer>
                {/* Solid White Background for the entire area (including bleed) */}
                <Rect
                  width={canvasWidth}
                  height={canvasHeight}
                  fill="white"
                />

                <Group x={bleedMm * MM_TO_PX} y={bleedMm * MM_TO_PX}>
                  {/* Background Plate with Rounded Corners (The actual phone) */}
                  <Rect
                    width={selectedModel.widthMm * MM_TO_PX}
                    height={selectedModel.heightMm * MM_TO_PX}
                    fill="white"
                    cornerRadius={selectedModel.cornerRadiusMm * MM_TO_PX}
                    stroke={isExporting ? "white" : "#141414"} // Use white stroke during export to blend with background
                    strokeWidth={1}
                  />

                  {images.length === 0 && !isExporting && (
                    <Text
                      text="Haz clic en 'Importar Imagen' para comenzar"
                      fontSize={12}
                      fontFamily="Inter, sans-serif"
                      fill="#141414"
                      opacity={0.3}
                      align="center"
                      verticalAlign="middle"
                      width={selectedModel.widthMm * MM_TO_PX}
                      height={selectedModel.heightMm * MM_TO_PX}
                      padding={20}
                    />
                  )}

                  {/* Design Images with Clipping */}
                  <Group clipFunc={(ctx) => {
                    const r = selectedModel.cornerRadiusMm * MM_TO_PX;
                    const w = selectedModel.widthMm * MM_TO_PX;
                    const h = selectedModel.heightMm * MM_TO_PX;
                    ctx.beginPath();
                    ctx.moveTo(r, 0);
                    ctx.lineTo(w - r, 0);
                    ctx.quadraticCurveTo(w, 0, w, r);
                    ctx.lineTo(w, h - r);
                    ctx.quadraticCurveTo(w, h, w - r, h);
                    ctx.lineTo(r, h);
                    ctx.quadraticCurveTo(0, h, 0, h - r);
                    ctx.lineTo(0, r);
                    ctx.quadraticCurveTo(0, 0, r, 0);
                    ctx.closePath();
                  }}>
                    {images.map((img) => (
                      <URLImage
                        key={img.id}
                        image={img}
                        isSelected={img.id === selectedId}
                        onSelect={() => setSelectedId(img.id)}
                        onChange={(newAttrs) => {
                          const newImages = images.slice();
                          const index = images.findIndex((i) => i.id === img.id);
                          newImages[index] = { ...images[index], ...newAttrs };
                          setImages(newImages);
                        }}
                      />
                    ))}
                  </Group>

                  {/* Camera Cutout Marker (Visual Only) */}
                  {!isExporting && (
                    <Rect
                      x={selectedModel.camera.xMm * MM_TO_PX}
                      y={selectedModel.camera.yMm * MM_TO_PX}
                      width={selectedModel.camera.widthMm * MM_TO_PX}
                      height={selectedModel.camera.heightMm * MM_TO_PX}
                      fill="rgba(0,0,0,0.1)"
                      stroke="#141414"
                      strokeWidth={1}
                      dash={[5, 5]}
                      cornerRadius={selectedModel.camera.cornerRadiusMm * MM_TO_PX}
                      listening={false}
                    />
                  )}

                  {/* Safe Area Line */}
                  {showSafeLines && !isExporting && (
                    <Rect
                      x={2 * MM_TO_PX}
                      y={2 * MM_TO_PX}
                      width={(selectedModel.widthMm - 4) * MM_TO_PX}
                      height={(selectedModel.heightMm - 4) * MM_TO_PX}
                      stroke="rgba(0,0,255,0.2)"
                      strokeWidth={1}
                      dash={[4, 4]}
                      cornerRadius={Math.max(0, selectedModel.cornerRadiusMm - 2) * MM_TO_PX}
                      listening={false}
                    />
                  )}
                </Group>
                
                {/* Bleed Marker (Dashed line showing where the model ends) */}
                {bleedMm > 0 && !isExporting && (
                  <Rect
                    x={bleedMm * MM_TO_PX}
                    y={bleedMm * MM_TO_PX}
                    width={selectedModel.widthMm * MM_TO_PX}
                    height={selectedModel.heightMm * MM_TO_PX}
                    stroke="rgba(255,0,0,0.3)"
                    strokeWidth={1}
                    dash={[2, 2]}
                    cornerRadius={selectedModel.cornerRadiusMm * MM_TO_PX}
                    listening={false}
                  />
                )}
              </Layer>
            </Stage>

            {/* Scale Indicators */}
            <div className="absolute -left-8 top-0 bottom-0 flex flex-col justify-between text-[10px] font-mono text-black/40">
              <div className="flex items-center gap-1"><div className="w-4 h-px bg-black/20"></div> 0</div>
              <div className="flex items-center gap-1"><div className="w-4 h-px bg-black/20"></div> {selectedModel.heightMm}mm</div>
            </div>
            <div className="absolute -top-8 left-0 right-0 flex justify-between text-[10px] font-mono text-black/40">
              <div className="flex flex-col items-center gap-1"><div className="h-4 w-px bg-black/20"></div> 0</div>
              <div className="flex flex-col items-center gap-1"><div className="h-4 w-px bg-black/20"></div> {selectedModel.widthMm}mm</div>
            </div>
          </div>

          {/* Bottom Action Buttons */}
          <div className="absolute bottom-8 flex items-center gap-4">
            <button 
              onClick={() => setShow3DPreview(true)}
              className="px-6 py-2.5 bg-white border border-[#141414]/10 rounded-full shadow-lg hover:bg-black hover:text-white transition-all flex items-center gap-2 text-sm font-medium"
            >
              <Eye size={16} /> Vista Previa 3D
            </button>
            <button 
              onClick={() => exportImage('jpg')}
              className="px-6 py-2.5 bg-[#141414] text-white rounded-full shadow-lg hover:bg-black transition-all flex items-center gap-2 text-sm font-medium"
            >
              <Download size={16} /> Exportar JPG (300 DPI)
            </button>
          </div>
        </div>

        {/* 3D Preview Modal */}
        <AnimatePresence>
          {show3DPreview && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-12"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col h-full"
              >
                <div className="p-6 border-b border-[#141414]/10 flex items-center justify-between">
                  <h3 className="text-lg font-bold">Vista Previa 3D del Equipo</h3>
                  <button onClick={() => setShow3DPreview(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex-1 bg-[#F5F5F4] flex items-center justify-center p-12 overflow-hidden">
                  <div className="relative group perspective-1000">
                    <motion.div 
                      animate={{ 
                        rotateY: [0, 10, -10, 0],
                        rotateX: [0, 5, -5, 0]
                      }}
                      transition={{ 
                        duration: 10, 
                        repeat: Infinity, 
                        ease: "easeInOut" 
                      }}
                      className="relative shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] rounded-[40px] overflow-hidden bg-black p-1"
                      style={{ 
                        width: selectedModel.widthMm * 3, 
                        height: selectedModel.heightMm * 3,
                      }}
                    >
                      {/* The design applied to the phone */}
                      <div 
                        className="w-full h-full rounded-[38px] overflow-hidden bg-white relative"
                      >
                        <div 
                          className="absolute inset-0"
                          style={{ 
                            backgroundImage: `url(${stageRef.current?.toDataURL()})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                        />
                        {/* Camera Cutout (Black) */}
                        <div 
                          className="absolute bg-black shadow-inner"
                          style={{ 
                            left: selectedModel.camera.xMm * 3,
                            top: selectedModel.camera.yMm * 3,
                            width: selectedModel.camera.widthMm * 3,
                            height: selectedModel.camera.heightMm * 3,
                            borderRadius: selectedModel.camera.cornerRadiusMm * 3
                          }}
                        />
                      </div>
                    </motion.div>
                  </div>
                </div>
                <div className="p-6 bg-white border-t border-[#141414]/10 flex justify-center">
                  <p className="text-sm text-black/40 italic">Vista simulada del producto final</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Info */}
        <div className="bg-white border-t border-[#141414]/10 p-4 flex items-center justify-between text-xs text-black/40">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Maximize size={12} /> {selectedModel.name}</span>
            <span className="flex items-center gap-1"><Printer size={12} /> 300 DPI Export Ready</span>
          </div>
          <div>Diseño para Sublimación en Placas de Metal</div>
        </div>
      </main>

      {/* Right Sidebar - Image Adjustments */}
      <aside className="w-80 bg-white border-l border-[#141414]/10 overflow-y-auto flex flex-col">
        <div className="p-6 border-b border-[#141414]/10">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-black/40 mb-6 flex items-center gap-2">
            <Settings2 size={14} /> Ajustes de Imagen
          </h2>
          
          {selectedImage ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-black/40">Posición X</label>
                  <input 
                    type="number" 
                    value={Math.round(selectedImage.x)} 
                    onChange={(e) => updateSelectedImage({ x: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-black/5 rounded-lg text-sm border border-transparent focus:border-black/10 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-black/40">Posición Y</label>
                  <input 
                    type="number" 
                    value={Math.round(selectedImage.y)} 
                    onChange={(e) => updateSelectedImage({ y: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-black/5 rounded-lg text-sm border border-transparent focus:border-black/10 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-black/40">Ancho (px)</label>
                  <input 
                    type="number" 
                    value={Math.round(selectedImage.width)} 
                    onChange={(e) => updateSelectedImage({ width: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-black/5 rounded-lg text-sm border border-transparent focus:border-black/10 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-black/40">Alto (px)</label>
                  <input 
                    type="number" 
                    value={Math.round(selectedImage.height)} 
                    onChange={(e) => updateSelectedImage({ height: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-black/5 rounded-lg text-sm border border-transparent focus:border-black/10 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-black/40">Escala de Imagen</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="range" 
                    min="10" 
                    max="400" 
                    value={Math.round((selectedImage.width / (selectedModel.widthMm * MM_TO_PX)) * 100)} 
                    onChange={(e) => {
                      const percent = Number(e.target.value) / 100;
                      const baseWidth = selectedModel.widthMm * MM_TO_PX;
                      const aspectRatio = selectedImage.height / selectedImage.width;
                      updateSelectedImage({ 
                        width: baseWidth * percent,
                        height: baseWidth * percent * aspectRatio
                      });
                    }}
                    className="flex-1 h-1 bg-black/10 rounded-lg appearance-none cursor-pointer accent-black"
                  />
                  <span className="text-xs font-mono w-10 text-right">
                    {Math.round((selectedImage.width / (selectedModel.widthMm * MM_TO_PX)) * 100)}%
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-black/40">Calidad de Impresión (DPI)</label>
                <div className="flex items-center justify-between p-3 bg-black/5 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-lg font-mono font-bold leading-none">
                      {Math.round(calculateDPI(selectedImage))}
                    </span>
                    <span className="text-[10px] text-black/40 uppercase font-bold mt-1">DPI Efectivo</span>
                  </div>
                  <div className={cn(
                    "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    getQualityLabel(calculateDPI(selectedImage)).color
                  )}>
                    {getQualityLabel(calculateDPI(selectedImage)).label}
                  </div>
                </div>
                <p className="text-[10px] text-black/40 leading-relaxed italic">
                  * Basado en el tamaño real del modelo ({selectedModel.widthMm}x{selectedModel.heightMm}mm)
                </p>
              </div>

              <div className="pt-2">
                <button 
                  onClick={() => {
                    const plateWidth = (selectedModel.widthMm + (bleedMm * 2)) * MM_TO_PX;
                    const plateHeight = (selectedModel.heightMm + (bleedMm * 2)) * MM_TO_PX;
                    const imgAspect = selectedImage.width / selectedImage.height;
                    const plateAspect = plateWidth / plateHeight;
                    
                    let newWidth, newHeight;
                    if (imgAspect > plateAspect) {
                      newHeight = plateHeight;
                      newWidth = plateHeight * imgAspect;
                    } else {
                      newWidth = plateWidth;
                      newHeight = plateWidth / imgAspect;
                    }

                    updateSelectedImage({
                      width: newWidth,
                      height: newHeight,
                      x: (canvasWidth - newWidth) / 2,
                      y: (canvasHeight - newHeight) / 2,
                      rotation: 0
                    });
                  }}
                  className="w-full py-2.5 bg-[#141414] text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-black/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Maximize size={14} /> Ajustar a la Placa
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-black/40">Rotación</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="range" 
                    min="0" 
                    max="360" 
                    value={selectedImage.rotation} 
                    onChange={(e) => updateSelectedImage({ rotation: Number(e.target.value) })}
                    className="flex-1 h-1 bg-black/10 rounded-lg appearance-none cursor-pointer accent-black"
                  />
                  <span className="text-xs font-mono w-8 text-right">{Math.round(selectedImage.rotation)}°</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center space-y-3">
              <ImageIcon className="mx-auto text-black/10" size={32} />
              <p className="text-xs text-black/40">Selecciona una imagen para ver sus ajustes</p>
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-black/40 flex items-center gap-2">
            <Printer size={14} /> Ajustes de Impresión
          </h2>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-black/40">Sangrado (mm)</label>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  value={bleedMm} 
                  onChange={(e) => setBleedMm(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-black/5 rounded-lg text-sm border border-transparent focus:border-black/10 outline-none"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input 
                  type="checkbox" 
                  checked={showSafeLines} 
                  onChange={(e) => setShowSafeLines(e.target.checked)}
                  className="sr-only"
                />
                <div className={cn(
                  "w-10 h-5 rounded-full transition-colors",
                  showSafeLines ? "bg-black" : "bg-black/10"
                )}></div>
                <div className={cn(
                  "absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform",
                  showSafeLines ? "translate-x-5" : "translate-x-0"
                )}></div>
              </div>
              <span className="text-sm font-medium text-black/60 group-hover:text-black transition-colors">Mostrar área segura</span>
            </label>
          </div>
        </div>
      </aside>

      <style>{`
        .pattern-grid {
          background-image: radial-gradient(#141414 0.5px, transparent 0.5px);
          background-size: 20px 20px;
        }
      `}</style>
    </div>
  );
}
