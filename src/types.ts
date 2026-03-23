export interface PhoneModel {
  id: string;
  brand: string;
  name: string;
  widthMm: number;
  heightMm: number;
  cornerRadiusMm: number;
  camera: {
    xMm: number;
    yMm: number;
    widthMm: number;
    heightMm: number;
    cornerRadiusMm: number;
  };
}

export interface DesignImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}
