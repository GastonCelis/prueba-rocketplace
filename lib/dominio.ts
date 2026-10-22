// Tipos y constantes del dominio (Spec 001).

export const TAMANO_PAGINA = 50;
export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

export const ESTADOS = ["pendiente", "pagado", "enviado", "entregado", "cancelado"] as const;
export type EstadoPedido = (typeof ESTADOS)[number];

export const ETIQUETAS_ESTADO: Record<EstadoPedido, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/** Fila de `public.orders` tal como la devuelve la API. */
export type Pedido = {
  id: number;
  number: number;
  customer_name: string;
  status: EstadoPedido;
  total: number;
  created_at: string;
};
