
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

  const { data: tickets, error } = await supabase
    .from('tickets')
    .select(
      'id, ticket_no, title, description, location, priority, status, category_id, created_at',
    )
    .eq('created_by', user.id)
    .order('created_at', { ascending: false });

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
      throw new Error(`Kategori bilgileri yüklenemedi: ${categoryError.message}`);
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
    throw new Error(
      `Kullanıcı bilgileri yüklenemedi: ${error.message}`,
    );
  }

  return (data ?? []) as TicketPerson[];
}

