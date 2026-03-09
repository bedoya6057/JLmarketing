export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      encartes: {
        Row: {
          bandera: string | null
          cadena: string | null
          ciudad: string | null
          created_at: string | null
          created_by: string | null
          encargado_1: string | null
          encargado_2: string | null
          estado: string | null
          fecha: string
          foto_registro: string | null
          foto_salida: string | null
          id: string
          mes: string | null
          mes_cod: number | null
          nombre: string
          tienda: string | null
          updated_at: string | null
        }
        Insert: {
          bandera?: string | null
          cadena?: string | null
          ciudad?: string | null
          created_at?: string | null
          created_by?: string | null
          encargado_1?: string | null
          encargado_2?: string | null
          estado?: string | null
          fecha: string
          foto_registro?: string | null
          foto_salida?: string | null
          id?: string
          mes?: string | null
          mes_cod?: number | null
          nombre: string
          tienda?: string | null
          updated_at?: string | null
        }
        Update: {
          bandera?: string | null
          cadena?: string | null
          ciudad?: string | null
          created_at?: string | null
          created_by?: string | null
          encargado_1?: string | null
          encargado_2?: string | null
          estado?: string | null
          fecha?: string
          foto_registro?: string | null
          foto_salida?: string | null
          id?: string
          mes?: string | null
          mes_cod?: number | null
          nombre?: string
          tienda?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encartes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encartes_encargado_1_fkey"
            columns: ["encargado_1"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encartes_encargado_2_fkey"
            columns: ["encargado_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_logs: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          message: string
          severity: string
          stack_trace: string | null
          timestamp: number
          type: string
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          severity: string
          stack_trace?: string | null
          timestamp: number
          type: string
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          severity?: string
          stack_trace?: string | null
          timestamp?: number
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      exhibiciones: {
        Row: {
          bandera: string | null
          cadena: string | null
          ciudad: string | null
          created_at: string | null
          created_by: string | null
          encargado_1: string | null
          encargado_2: string | null
          estado: string | null
          fecha: string
          foto_registro: string | null
          id: string
          mes: string | null
          mes_cod: number | null
          nombre: string
          tienda: string | null
          updated_at: string | null
        }
        Insert: {
          bandera?: string | null
          cadena?: string | null
          ciudad?: string | null
          created_at?: string | null
          created_by?: string | null
          encargado_1?: string | null
          encargado_2?: string | null
          estado?: string | null
          fecha: string
          foto_registro?: string | null
          id?: string
          mes?: string | null
          mes_cod?: number | null
          nombre: string
          tienda?: string | null
          updated_at?: string | null
        }
        Update: {
          bandera?: string | null
          cadena?: string | null
          ciudad?: string | null
          created_at?: string | null
          created_by?: string | null
          encargado_1?: string | null
          encargado_2?: string | null
          estado?: string | null
          fecha?: string
          foto_registro?: string | null
          id?: string
          mes?: string | null
          mes_cod?: number | null
          nombre?: string
          tienda?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      productos: {
        Row: {
          alto_azucar: boolean | null
          alto_grasas_saturadas: boolean | null
          alto_sodio: boolean | null
          aporte_col: number | null
          atributo: string | null
          bi_tri_precio: string | null
          cabecera: string | null
          cant_auspiciador: string | null
          cantidad_comprar: string | null
          categoria: string | null
          categoria_general: string | null
          cod_auspiciador: string | null
          cod_gpo_articulo: string | null
          cod_interno: string | null
          codigo_local: string | null
          condicion_especial: string | null
          contiene_grasas_trans: boolean | null
          created_at: string | null
          cuotas: string | null
          descripcion_auspiciador: string | null
          descripcion_col: string | null
          descripcion_mecanica_tarjeta: string | null
          descripcion_producto: string | null
          descripcion_producto_carteleria: string
          descripcion_variacion_abierta: string | null
          descripcion_variacion_tarjeta: string | null
          division: string | null
          dp: string | null
          encarte_id: string | null
          estado_carga: string | null
          estado_producto: string | null
          estado_variacion: string | null
          exhibicion: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          formato: string | null
          foto_publicar: string | null
          gasto_comercial_promos_toh: string | null
          gasto_financiero: number | null
          gasto_producto: number | null
          gasto_toh: string | null
          gasto_total_promos_oh: string | null
          gerente_aprobador: string | null
          id: string
          legal: string | null
          logo: string | null
          macrocategoria: string | null
          maximo_abierto: string | null
          maximo_tarjeta: string | null
          mecanica: string | null
          medidas: string | null
          medio_pago: string | null
          microcategoria: string | null
          monto_minimo: number | null
          nombre_campana: string | null
          nombre_mecanica: string | null
          num_promo: string | null
          numero_cartel: string | null
          pagina: string | null
          precio_encarte: number | null
          precio_pack: number | null
          precio_pack_tarjeta: number | null
          precio_promo: number | null
          precio_promo_tarjeta: number | null
          precio_regular: number | null
          producto_id: string | null
          promocion_acumulable: string | null
          regalos: string | null
          tags: string | null
          tipo_promocion: string | null
          tipo_requerimiento: string | null
          unidad_limite: string | null
          unidad_medida: string | null
          usuario_comercial: string | null
          usuario_pricing: string | null
          usuario_promociones: string | null
          uxb: string | null
          variacion_promocional_abierta: string | null
          variacion_promocional_tarjeta: string | null
        }
        Insert: {
          alto_azucar?: boolean | null
          alto_grasas_saturadas?: boolean | null
          alto_sodio?: boolean | null
          aporte_col?: number | null
          atributo?: string | null
          bi_tri_precio?: string | null
          cabecera?: string | null
          cant_auspiciador?: string | null
          cantidad_comprar?: string | null
          categoria?: string | null
          categoria_general?: string | null
          cod_auspiciador?: string | null
          cod_gpo_articulo?: string | null
          cod_interno?: string | null
          codigo_local?: string | null
          condicion_especial?: string | null
          contiene_grasas_trans?: boolean | null
          created_at?: string | null
          cuotas?: string | null
          descripcion_auspiciador?: string | null
          descripcion_col?: string | null
          descripcion_mecanica_tarjeta?: string | null
          descripcion_producto?: string | null
          descripcion_producto_carteleria: string
          descripcion_variacion_abierta?: string | null
          descripcion_variacion_tarjeta?: string | null
          division?: string | null
          dp?: string | null
          encarte_id?: string | null
          estado_carga?: string | null
          estado_producto?: string | null
          estado_variacion?: string | null
          exhibicion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          formato?: string | null
          foto_publicar?: string | null
          gasto_comercial_promos_toh?: string | null
          gasto_financiero?: number | null
          gasto_producto?: number | null
          gasto_toh?: string | null
          gasto_total_promos_oh?: string | null
          gerente_aprobador?: string | null
          id?: string
          legal?: string | null
          logo?: string | null
          macrocategoria?: string | null
          maximo_abierto?: string | null
          maximo_tarjeta?: string | null
          mecanica?: string | null
          medidas?: string | null
          medio_pago?: string | null
          microcategoria?: string | null
          monto_minimo?: number | null
          nombre_campana?: string | null
          nombre_mecanica?: string | null
          num_promo?: string | null
          numero_cartel?: string | null
          pagina?: string | null
          precio_encarte?: number | null
          precio_pack?: number | null
          precio_pack_tarjeta?: number | null
          precio_promo?: number | null
          precio_promo_tarjeta?: number | null
          precio_regular?: number | null
          producto_id?: string | null
          promocion_acumulable?: string | null
          regalos?: string | null
          tags?: string | null
          tipo_promocion?: string | null
          tipo_requerimiento?: string | null
          unidad_limite?: string | null
          unidad_medida?: string | null
          usuario_comercial?: string | null
          usuario_pricing?: string | null
          usuario_promociones?: string | null
          uxb?: string | null
          variacion_promocional_abierta?: string | null
          variacion_promocional_tarjeta?: string | null
        }
        Update: {
          alto_azucar?: boolean | null
          alto_grasas_saturadas?: boolean | null
          alto_sodio?: boolean | null
          aporte_col?: number | null
          atributo?: string | null
          bi_tri_precio?: string | null
          cabecera?: string | null
          cant_auspiciador?: string | null
          cantidad_comprar?: string | null
          categoria?: string | null
          categoria_general?: string | null
          cod_auspiciador?: string | null
          cod_gpo_articulo?: string | null
          cod_interno?: string | null
          codigo_local?: string | null
          condicion_especial?: string | null
          contiene_grasas_trans?: boolean | null
          created_at?: string | null
          cuotas?: string | null
          descripcion_auspiciador?: string | null
          descripcion_col?: string | null
          descripcion_mecanica_tarjeta?: string | null
          descripcion_producto?: string | null
          descripcion_producto_carteleria?: string
          descripcion_variacion_abierta?: string | null
          descripcion_variacion_tarjeta?: string | null
          division?: string | null
          dp?: string | null
          encarte_id?: string | null
          estado_carga?: string | null
          estado_producto?: string | null
          estado_variacion?: string | null
          exhibicion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          formato?: string | null
          foto_publicar?: string | null
          gasto_comercial_promos_toh?: string | null
          gasto_financiero?: number | null
          gasto_producto?: number | null
          gasto_toh?: string | null
          gasto_total_promos_oh?: string | null
          gerente_aprobador?: string | null
          id?: string
          legal?: string | null
          logo?: string | null
          macrocategoria?: string | null
          maximo_abierto?: string | null
          maximo_tarjeta?: string | null
          mecanica?: string | null
          medidas?: string | null
          medio_pago?: string | null
          microcategoria?: string | null
          monto_minimo?: number | null
          nombre_campana?: string | null
          nombre_mecanica?: string | null
          num_promo?: string | null
          numero_cartel?: string | null
          pagina?: string | null
          precio_encarte?: number | null
          precio_pack?: number | null
          precio_pack_tarjeta?: number | null
          precio_promo?: number | null
          precio_promo_tarjeta?: number | null
          precio_regular?: number | null
          producto_id?: string | null
          promocion_acumulable?: string | null
          regalos?: string | null
          tags?: string | null
          tipo_promocion?: string | null
          tipo_requerimiento?: string | null
          unidad_limite?: string | null
          unidad_medida?: string | null
          usuario_comercial?: string | null
          usuario_pricing?: string | null
          usuario_promociones?: string | null
          uxb?: string | null
          variacion_promocional_abierta?: string | null
          variacion_promocional_tarjeta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_encarte_id_fkey"
            columns: ["encarte_id"]
            isOneToOne: false
            referencedRelation: "encartes"
            referencedColumns: ["id"]
          },
        ]
      }
      productos_exhibicion: {
        Row: {
          cod_producto: string | null
          codigo_exhibicion: string | null
          created_at: string | null
          descripcion_producto: string
          estado_producto: string | null
          exhibicion_id: string | null
          id: string
          linea: string | null
          macrocategoria: string | null
          marca: string | null
          microcategoria: string | null
          seccion: string | null
          suma_tiendas: string | null
          tienda: string | null
          tipo_exhibicion: string | null
          vigencia: string | null
        }
        Insert: {
          cod_producto?: string | null
          codigo_exhibicion?: string | null
          created_at?: string | null
          descripcion_producto: string
          estado_producto?: string | null
          exhibicion_id?: string | null
          id?: string
          linea?: string | null
          macrocategoria?: string | null
          marca?: string | null
          microcategoria?: string | null
          seccion?: string | null
          suma_tiendas?: string | null
          tienda?: string | null
          tipo_exhibicion?: string | null
          vigencia?: string | null
        }
        Update: {
          cod_producto?: string | null
          codigo_exhibicion?: string | null
          created_at?: string | null
          descripcion_producto?: string
          estado_producto?: string | null
          exhibicion_id?: string | null
          id?: string
          linea?: string | null
          macrocategoria?: string | null
          marca?: string | null
          microcategoria?: string | null
          seccion?: string | null
          suma_tiendas?: string | null
          tienda?: string | null
          tipo_exhibicion?: string | null
          vigencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_exhibicion_exhibicion_id_fkey"
            columns: ["exhibicion_id"]
            isOneToOne: false
            referencedRelation: "exhibiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      progreso_encuestador: {
        Row: {
          acompaniamiento_encargado: boolean | null
          created_at: string | null
          current_index: number | null
          distrito: string | null
          encarte_id: string
          foto_ingreso_url: string | null
          foto_salida_url: string | null
          has_started: boolean | null
          id: string
          responded_product_ids: string[] | null
          selected_macrocategoria: string | null
          selected_microcategoria: string | null
          skipped_product_ids: string[] | null
          started_fresh: boolean | null
          supervisor: string | null
          tienda: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          acompaniamiento_encargado?: boolean | null
          created_at?: string | null
          current_index?: number | null
          distrito?: string | null
          encarte_id: string
          foto_ingreso_url?: string | null
          foto_salida_url?: string | null
          has_started?: boolean | null
          id?: string
          responded_product_ids?: string[] | null
          selected_macrocategoria?: string | null
          selected_microcategoria?: string | null
          skipped_product_ids?: string[] | null
          started_fresh?: boolean | null
          supervisor?: string | null
          tienda?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          acompaniamiento_encargado?: boolean | null
          created_at?: string | null
          current_index?: number | null
          distrito?: string | null
          encarte_id?: string
          foto_ingreso_url?: string | null
          foto_salida_url?: string | null
          has_started?: boolean | null
          id?: string
          responded_product_ids?: string[] | null
          selected_macrocategoria?: string | null
          selected_microcategoria?: string | null
          skipped_product_ids?: string[] | null
          started_fresh?: boolean | null
          supervisor?: string | null
          tienda?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      progreso_encuestador_exhibicion: {
        Row: {
          acompaniamiento_encargado: boolean | null
          created_at: string | null
          current_index: number | null
          exhibicion_id: string
          foto_ingreso_url: string | null
          has_started: boolean | null
          id: string
          responded_product_ids: string[] | null
          selected_macrocategoria: string | null
          selected_microcategoria: string | null
          skipped_product_ids: string[] | null
          started_fresh: boolean | null
          supervisor: string | null
          tienda: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          acompaniamiento_encargado?: boolean | null
          created_at?: string | null
          current_index?: number | null
          exhibicion_id: string
          foto_ingreso_url?: string | null
          has_started?: boolean | null
          id?: string
          responded_product_ids?: string[] | null
          selected_macrocategoria?: string | null
          selected_microcategoria?: string | null
          skipped_product_ids?: string[] | null
          started_fresh?: boolean | null
          supervisor?: string | null
          tienda?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          acompaniamiento_encargado?: boolean | null
          created_at?: string | null
          current_index?: number | null
          exhibicion_id?: string
          foto_ingreso_url?: string | null
          has_started?: boolean | null
          id?: string
          responded_product_ids?: string[] | null
          selected_macrocategoria?: string | null
          selected_microcategoria?: string | null
          skipped_product_ids?: string[] | null
          started_fresh?: boolean | null
          supervisor?: string | null
          tienda?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      respuestas: {
        Row: {
          año: number | null
          bandera: string | null
          cartel_presenta_precio: boolean | null
          categoria: string | null
          ciudad: string | null
          ciudad_cadena: string | null
          cod_interno: string | null
          created_at: string | null
          created_by: string | null
          cumplimiento_carteles: boolean | null
          encargado: string | null
          encargado_2: string | null
          encarte: string | null
          encarte_id: string | null
          fecha: string | null
          foto: string | null
          foto_registro: string | null
          id: string
          macrocategoria: string | null
          mes: string | null
          mes_cod: number | null
          obs_1: string | null
          observaciones: string | null
          precio_encarte: number | null
          precio_encontrado: number | null
          precio_ok: boolean | null
          precio_tarjeta: number | null
          presencia_cartel: boolean | null
          presencia_cartel_con_tarjeta: boolean | null
          presencia_producto: boolean | null
          producto: string | null
          producto_id: string | null
          cartel_tipo_legal: string | null
          motivo_ausencia: string | null
          supervisor: string | null
          tienda: string | null
          ubicacion_sku: string | null
        }
        Insert: {
          año?: number | null
          bandera?: string | null
          cartel_presenta_precio?: boolean | null
          categoria?: string | null
          ciudad?: string | null
          ciudad_cadena?: string | null
          cod_interno?: string | null
          created_at?: string | null
          created_by?: string | null
          cumplimiento_carteles?: boolean | null
          encargado?: string | null
          encargado_2?: string | null
          encarte?: string | null
          encarte_id?: string | null
          fecha?: string | null
          foto?: string | null
          foto_registro?: string | null
          id?: string
          macrocategoria?: string | null
          mes?: string | null
          mes_cod?: number | null
          obs_1?: string | null
          observaciones?: string | null
          precio_encarte?: number | null
          precio_encontrado?: number | null
          precio_ok?: boolean | null
          precio_tarjeta?: number | null
          presencia_cartel?: boolean | null
          presencia_cartel_con_tarjeta?: boolean | null
          presencia_producto?: boolean | null
          producto?: string | null
          producto_id?: string | null
          cartel_tipo_legal?: string | null
          motivo_ausencia?: string | null
          supervisor?: string | null
          tienda?: string | null
          ubicacion_sku?: string | null
        }
        Update: {
          año?: number | null
          bandera?: string | null
          cartel_presenta_precio?: boolean | null
          categoria?: string | null
          ciudad?: string | null
          ciudad_cadena?: string | null
          cod_interno?: string | null
          created_at?: string | null
          created_by?: string | null
          cumplimiento_carteles?: boolean | null
          encargado?: string | null
          encargado_2?: string | null
          encarte?: string | null
          encarte_id?: string | null
          fecha?: string | null
          foto?: string | null
          foto_registro?: string | null
          id?: string
          macrocategoria?: string | null
          mes?: string | null
          mes_cod?: number | null
          obs_1?: string | null
          observaciones?: string | null
          precio_encarte?: number | null
          precio_encontrado?: number | null
          precio_ok?: boolean | null
          precio_tarjeta?: number | null
          presencia_cartel?: boolean | null
          presencia_cartel_con_tarjeta?: boolean | null
          presencia_producto?: boolean | null
          producto?: string | null
          producto_id?: string | null
          cartel_tipo_legal?: string | null
          motivo_ausencia?: string | null
          supervisor?: string | null
          tienda?: string | null
          ubicacion_sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "respuestas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respuestas_encarte_id_fkey"
            columns: ["encarte_id"]
            isOneToOne: false
            referencedRelation: "encartes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respuestas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      respuestas_exhibicion: {
        Row: {
          bandera: string | null
          ciudad: string | null
          cod_producto: string | null
          codigo_exhibicion: string | null
          created_at: string | null
          created_by: string | null
          descripcion_producto: string | null
          encargado: string | null
          encargado_2: string | null
          exhibicion_id: string | null
          fecha: string | null
          foto: string | null
          foto_registro: string | null
          id: string
          linea: string | null
          observaciones: string | null
          precio_tarjeta: number | null
          presencia_cartel_con_tarjeta: boolean | null
          presencia_exhibicion: string | null
          producto_id: string | null
          seccion: string | null
          tienda: string | null
          tipo_exhibicion: string | null
          ubicacion: string | null
        }
        Insert: {
          bandera?: string | null
          ciudad?: string | null
          cod_producto?: string | null
          codigo_exhibicion?: string | null
          created_at?: string | null
          created_by?: string | null
          descripcion_producto?: string | null
          encargado?: string | null
          encargado_2?: string | null
          exhibicion_id?: string | null
          fecha?: string | null
          foto?: string | null
          foto_registro?: string | null
          id?: string
          linea?: string | null
          observaciones?: string | null
          precio_tarjeta?: number | null
          presencia_cartel_con_tarjeta?: boolean | null
          presencia_exhibicion?: string | null
          producto_id?: string | null
          seccion?: string | null
          tienda?: string | null
          tipo_exhibicion?: string | null
          ubicacion?: string | null
        }
        Update: {
          bandera?: string | null
          ciudad?: string | null
          cod_producto?: string | null
          codigo_exhibicion?: string | null
          created_at?: string | null
          created_by?: string | null
          descripcion_producto?: string | null
          encargado?: string | null
          encargado_2?: string | null
          exhibicion_id?: string | null
          fecha?: string | null
          foto?: string | null
          foto_registro?: string | null
          id?: string
          linea?: string | null
          observaciones?: string | null
          precio_tarjeta?: number | null
          presencia_cartel_con_tarjeta?: boolean | null
          presencia_exhibicion?: string | null
          producto_id?: string | null
          seccion?: string | null
          tienda?: string | null
          tipo_exhibicion?: string | null
          ubicacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "respuestas_exhibicion_exhibicion_id_fkey"
            columns: ["exhibicion_id"]
            isOneToOne: false
            referencedRelation: "exhibiciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respuestas_exhibicion_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos_exhibicion"
            referencedColumns: ["id"]
          },
        ]
      }
      tiendas: {
        Row: {
          bandera: string
          created_at: string
          distrito: string | null
          id: string
          responsable: string | null
          tienda: string
          ubigeo: string | null
        }
        Insert: {
          bandera: string
          created_at?: string
          distrito?: string | null
          id?: string
          responsable?: string | null
          tienda: string
          ubigeo?: string | null
        }
        Update: {
          bandera?: string
          created_at?: string
          distrito?: string | null
          id?: string
          responsable?: string | null
          tienda?: string
          ubigeo?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_active: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "auditor" | "encuestador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "auditor", "encuestador"],
    },
  },
} as const
