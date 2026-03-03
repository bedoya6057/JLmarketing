import { z } from "zod";

export const respuestaSchema = z.object({
  encarte_id: z.string().uuid(),
  producto_id: z.string().uuid(),
  presencia_producto: z.boolean(),
  presencia_cartel: z.boolean().optional(),
  presencia_cartel_con_tarjeta: z.boolean().optional(),
  cartel_presenta_precio: z.boolean().optional(),
  precio_encontrado: z.number().min(0).max(9999999).optional().nullable(),
  precio_tarjeta: z.number().min(0).max(9999999).optional().nullable(),
  precio_encarte: z.number().min(0).max(9999999).optional().nullable(),
  precio_ok: z.boolean().optional(),
  cumplimiento_carteles: z.boolean().optional(),
  ubicacion_sku: z.string().max(500).optional().nullable(),
  observaciones: z.string().max(2000).optional().nullable(),
  foto: z.string().max(1000).optional().nullable(),
  supervisor: z.string().max(200).optional().nullable(),
  encargado: z.string().uuid().optional().nullable(),
  tienda: z.string().max(200).optional().nullable(),
  ciudad: z.string().max(200).optional().nullable(),
  bandera: z.string().max(200).optional().nullable(),
  macrocategoria: z.string().max(200).optional().nullable(),
  categoria: z.string().max(200).optional().nullable(),
});

export const respuestaExhibicionSchema = z.object({
  exhibicion_id: z.string().uuid(),
  producto_id: z.string().uuid(),
  presencia_exhibicion: z.string().max(50).optional().nullable(),
  ubicacion: z.string().max(500).optional().nullable(),
  observaciones: z.string().max(2000).optional().nullable(),
  foto: z.string().max(1000).optional().nullable(),
});
