
import { supabase } from '../supabase/client';

export type TicketCategory = {
  id: string;
  name: string;
};

export type CreateTicketInput = {
  title: string;
  description: string;
  categoryId: string;
  location: string;
  priority: 'low' | 'normal' | 'high';
};

export type TicketStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'waiting_parts'
  | 'resolved'
  | 'closed'
  | 'cancelled';

export type TicketPriority = 'low' | 'normal' | 'high';

export type TicketListItem = {
  id: string;
  ticket_no: string;
  title: string;
  description: string | null;
  location: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  category_id: string | null;
  category_name: string | null;
  created_at: string;
};

export type TicketDetail = {
  id: string;
  ticket_no: string;
  title: string;
  description: string | null;
  location: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  category_id: string | null;
  category_name: string | null;
  created_by: string;
  assigned_to: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketHistoryItem = {
  id: string;
  ticket_id: string;
  actor_id: string | null;
  action: string;
  old_value: unknown;
  new_value: unknown;
  note: string | null;
  created_at: string;
};

export type TicketPerson = {
  user_id: string;
  full_name: string | null;
  role: string;
};

export type CurrentUserContext = {
  userId: string;
  role: 'manager' | 'technician' | 'employee';
};

export type AssignableTechnician = {
  user_id: string;
  full_name: string;
};

export async function getActiveCategories(): Promise<TicketCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  if (error) {
    throw new Error(`Kategoriler yüklenemedi: ${error.message}`);
  }

  return data ?? [];
}

export async function createTicket(input: CreateTicketInput) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(`Kullanıcı bilgisi alınamadı: ${userError.message}`);
  }

  if (!user) {
    throw new Error('Servis kaydı oluşturmak için giriş yapmalısınız.');
  }

  const payload = {
    title: input.title.trim(),
    description: input.description.trim(),
    category_id: input.categoryId,
    location: input.location.trim(),
    priority: input.priority,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from('tickets')
    .insert(payload)
    .select('id, ticket_no')
    .single();

  if (error) {
    throw new Error(`Servis kaydı oluşturulamadı: ${error.message}`);
  }

  return data;
}

export async function getMyTickets(): Promise<TicketListItem[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(`Kullanıcı bilgisi alınamadı: ${userError.message}`);
  }

  if (!user) {
    throw new Error('Servis kayıtlarını görmek için giriş yapmalısınız.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    throw new Error(`Kullanıcı rolü alınamadı: ${profileError.message}`);
  }

  let query = supabase
    .from('tickets')
    .select(
      'id, ticket_no, title, description, location, priority, status, category_id, created_at',
    );

  if (profile.role === 'technician') {
    query = query.or(
      `created_by.eq.${user.id},assigned_to.eq.${user.id}`,
    );
  } else if (profile.role === 'employee') {
    query = query.eq('created_by', user.id);
  }

  const { data: tickets, error } = await query.order('created_at', {
    ascending: false,
  });

  if (error) {
    throw new Error(`Servis kayıtları yüklenemedi: ${error.message}`);
  }

  const categoryIds = [
    ...new Set(
      (tickets ?? [])
        .map((ticket) => ticket.category_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  let categoryNames = new Map<string, string>();

  if (categoryIds.length > 0) {
    const { data: categories, error: categoryError } = await supabase
      .from('categories')
      .select('id, name')
      .in('id', categoryIds);

    if (categoryError) {
      throw new Error(
        `Kategori bilgileri yüklenemedi: ${categoryError.message}`,
      );
    }

    categoryNames = new Map(
      (categories ?? []).map((category) => [category.id, category.name]),
    );
  }

  return (tickets ?? []).map((ticket) => ({
    ...ticket,
    priority: ticket.priority as TicketPriority,
    status: ticket.status as TicketStatus,
    category_name: ticket.category_id
      ? (categoryNames.get(ticket.category_id) ?? null)
      : null,
  }));
}

export async function getTicketDetail(
  ticketId: string,
): Promise<TicketDetail> {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(
      'id, ticket_no, title, description, location, priority, status, category_id, created_by, assigned_to, due_at, created_at, updated_at',
    )
    .eq('id', ticketId)
    .single();

  if (error) {
    throw new Error(`Servis detayı yüklenemedi: ${error.message}`);
  }

  let categoryName: string | null = null;

  if (ticket.category_id) {
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('name')
      .eq('id', ticket.category_id)
      .maybeSingle();

    if (categoryError) {
      throw new Error(`Kategori bilgisi yüklenemedi: ${categoryError.message}`);
    }

    categoryName = category?.name ?? null;
  }

  return {
    ...ticket,
    priority: ticket.priority as TicketPriority,
    status: ticket.status as TicketStatus,
    category_name: categoryName,
  };
}

export async function getTicketHistory(
  ticketId: string,
): Promise<TicketHistoryItem[]> {
  const { data, error } = await supabase
    .from('ticket_history')
    .select(
      'id, ticket_id, actor_id, action, old_value, new_value, note, created_at',
    )
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`İşlem geçmişi yüklenemedi: ${error.message}`);
  }

  return data ?? [];
}

export async function getTicketPeople(
  ticketId: string,
): Promise<TicketPerson[]> {
  const { data, error } = await supabase.rpc('get_ticket_people', {
    p_ticket_id: ticketId,
  });

  if (error) {
    throw new Error(`Kullanıcı bilgileri yüklenemedi: ${error.message}`);
  }

  return (data ?? []) as TicketPerson[];
}

export async function getCurrentUserContext(): Promise<CurrentUserContext> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(`Kullanıcı bilgisi alınamadı: ${userError.message}`);
  }

  if (!user) {
    throw new Error('Oturum açmanız gerekiyor.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    throw new Error(`Kullanıcı rolü alınamadı: ${profileError.message}`);
  }

  return {
    userId: user.id,
    role: profile.role as CurrentUserContext['role'],
  };
}

export async function updateTicketStatus(
  ticketId: string,
  newStatus: TicketStatus,
): Promise<void> {
  const { error } = await supabase.rpc('update_ticket_status', {
    p_ticket_id: ticketId,
    p_new_status: newStatus,
  });

  if (error) {
    throw new Error(`Servis durumu güncellenemedi: ${error.message}`);
  }
}

export async function getAssignableTechnicians(): Promise<AssignableTechnician[]> {
  const { data, error } = await supabase.rpc('get_assignable_technicians');

  if (error) {
    throw new Error(`Teknisyen listesi yüklenemedi: ${error.message}`);
  }

  return (data ?? []) as AssignableTechnician[];
}

export async function assignTicket(
  ticketId: string,
  technicianId: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('assign_ticket', {
    p_ticket_id: ticketId,
    p_technician_id: technicianId,
  });

  if (error) {
    throw new Error(`Teknisyen ataması yapılamadı: ${error.message}`);
  }
}


export type Part = {
  id: string;
  code: string;
  name: string;
  unit: string;
  stock_quantity: number;
};

export type TicketStockMovement = {
  id: string;
  part_id: string;
  ticket_id: string | null;
  type: 'entry' | 'usage' | 'usage_reversal';
  quantity: number;
  reverses_movement_id: string | null;
  request_id: string;
  actor_id: string;
  reason: string | null;
  created_at: string;
  part: {
    code: string;
    name: string;
    unit: string;
  } | null;
};

export async function getActiveParts(): Promise<Part[]> {
  const { data, error } = await supabase
    .from('parts')
    .select('id, code, name, unit, stock_quantity')
    .eq('is_active', true)
    .order('name');

  if (error) {
    throw new Error(`Parça listesi yüklenemedi: ${error.message}`);
  }

  return (data ?? []) as Part[];
}

export async function getTicketStockMovements(
  ticketId: string,
): Promise<TicketStockMovement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select(`
      id,
      part_id,
      ticket_id,
      type,
      quantity,
      reverses_movement_id,
      request_id,
      actor_id,
      reason,
      created_at,
      part:parts (
        code,
        name,
        unit
      )
    `)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Stok hareketleri yüklenemedi: ${error.message}`);
  }

  return (data ?? []) as unknown as TicketStockMovement[];
}

export async function recordPartUsage(
  requestId: string,
  ticketId: string,
  partId: string,
  quantity: number,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('use_part', {
    p_request_id: requestId,
    p_ticket_id: ticketId,
    p_part_id: partId,
    p_quantity: quantity,
    p_reason: reason.trim(),
  });

  if (error) {
    throw new Error(`Parça kullanımı kaydedilemedi: ${error.message}`);
  }
}

export async function reversePartUsage(
  requestId: string,
  movementId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('reverse_part_usage', {
    p_request_id: requestId,
    p_movement_id: movementId,
    p_reason: reason.trim(),
  });

  if (error) {
    throw new Error(`Parça kullanımı geri alınamadı: ${error.message}`);
  }
}
export async function createStockEntry(
  requestId: string,
  partId: string,
  quantity: number,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('create_stock_entry', {
    p_request_id: requestId,
    p_part_id: partId,
    p_quantity: quantity,
    p_reason: reason.trim(),
  });

  if (error) {
    throw new Error(`Stok girişi yapılamadı: ${error.message}`);
  }
}
export async function getStockMovementHistory(): Promise<
  StockMovementHistoryItem[]
> {
  const { data, error } = await supabase.rpc(
    'get_stock_movement_history',
  );

  if (error) {
    throw new Error(`Stok hareket geçmişi yüklenemedi: ${error.message}`);
  }

  return (data ?? []) as StockMovementHistoryItem[];
}

export type StockMovementHistoryItem = {
  id: string;
  part_id: string;
  part_code: string;
  part_name: string;
  unit: string;
  ticket_id: string | null;
  ticket_no: string | null;
  movement_type: 'entry' | 'usage' | 'usage_reversal';
  quantity: number;
  reason: string | null;
  actor_id: string;
  actor_name: string;
  created_at: string;
};
