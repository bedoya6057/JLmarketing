export interface StudyPhotoStats {
  id: string;
  nombre: string;
  estado: string;
  total_respuestas: number;
  sin_foto: number;
  con_foto: number;
  sin_foto_ingreso: number;
  con_foto_ingreso: number;
  duplicados: number;
  tipo: "encarte" | "exhibicion";
}

export interface MissingPhotoRecord {
  id: string;
  tienda: string;
  producto: string;
  fecha: string;
  encargado: string;
}

export interface DuplicatePhotoRecord {
  url: string;
  count: number;
  records: {
    id: string;
    tienda: string;
    fecha: string;
  }[];
}

export interface IngresoPhotoRecord {
  id: string;
  tienda: string;
  usuario: string;
  fecha: string;
}
