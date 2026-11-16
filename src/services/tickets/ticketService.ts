
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
  version: number;
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

export type TicketMessage = {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
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
  'id, ticket_no, title, description, location, priority, status, category_id, created_by, assigned_to, due_at, version, created_at, updated_at',
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

export async function getTicketMessages(
  ticketId: string,
): Promise<TicketMessage[]> {
  const { data, error } = await supabase
    .from('ticket_messages')
    .select('id, ticket_id, author_id, body, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Mesajlar yüklenemedi: ${error.message}`);
  }

  return (data ?? []) as TicketMessage[];
}
export async function sendTicketMessage(
  ticketId: string,
  body: string,
): Promise<TicketMessage> {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    throw new Error('Mesaj boş olamaz.');
  }

  if (trimmedBody.length > 5000) {
    throw new Error('Mesaj 5000 karakterden uzun olamaz.');
  }

  const { data, error } = await supabase.rpc('add_ticket_message', {
    p_ticket_id: ticketId,
    p_body: trimmedBody,
  });

  if (error) {
    throw new Error(`Mesaj gönderilemedi: ${error.message}`);
  }

  return data as TicketMessage;
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
  ticket: Pick<TicketDetail, 'id' | 'status' | 'version'>,
  newStatus: TicketStatus,
  note?: string,
): Promise<void> {
  const { error } = await supabase.rpc('transition_ticket', {
    p_ticket_id: ticket.id,
    p_to_status: newStatus,
    p_expected_status: ticket.status,
    p_expected_version: ticket.version,
    p_note: note?.trim() || null,
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
    is_active: boolean;
};

export type PartInput = {
  code: string;
  name: string;
  unit: string;
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

export async function getParts(
  includeInactive = false,
): Promise<Part[]> {
  let query = supabase
    .from('parts')
    .select('id, code, name, unit, stock_quantity, is_active')
    .order('name');

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Parça listesi yüklenemedi: ${error.message}`);
  }

  return (data ?? []) as Part[];
}

export async function getActiveParts(): Promise<Part[]> {
  return getParts(false);
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

export async function addPart(input: PartInput): Promise<Part> {
  console.log('[addPart] Input:', input);
  console.log('[addPart] Supabase RPC:', typeof supabase.rpc);

  const { data, error } = await supabase.rpc('add_part', {
    p_code: input.code.trim(),
    p_name: input.name.trim(),
    p_unit: input.unit.trim(),
  });

  console.log('[addPart] Response:', { data, error });

  if (error) {
    console.error('[addPart] Supabase error:', error);
    throw new Error(`Parça eklenemedi: ${error.message}`);
  }

  return data as Part;
}

export async function updatePart(
  partId: string,
  input: PartInput,
): Promise<Part> {
  const { data, error } = await supabase.rpc('update_part', {
    p_part_id: partId,
    p_code: input.code.trim(),
    p_name: input.name.trim(),
    p_unit: input.unit.trim(),
  });

  if (error) {
    throw new Error(`Parça güncellenemedi: ${error.message}`);
  }

  return data as Part;
}

export async function setPartActive(
  partId: string,
  isActive: boolean,
): Promise<Part> {
  const { data, error } = await supabase.rpc('set_part_active', {
    p_part_id: partId,
    p_is_active: isActive,
  });

  if (error) {
    throw new Error(
      isActive
        ? `Parça aktifleştirilemedi: ${error.message}`
        : `Parça pasife alınamadı: ${error.message}`,
    );
  }

  return data as Part;
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


export type TicketAttachmentInput = {
  uri: string;
  mimeType: 'image/jpeg' | 'image/png';
  fileSize: number;
};

export type TicketAttachment = {
  id: string;
  ticket_id: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
};

export type TicketAttachmentWithUrl = TicketAttachment & {
  signedUrl: string;
};


export async function uploadTicketAttachment(
  ticketId: string,
  attachment: TicketAttachmentInput,
): Promise<string> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Fotoğraf yüklemek için oturum açmalısınız.');
  }

  if (
    attachment.mimeType !== 'image/jpeg' &&
    attachment.mimeType !== 'image/png'
  ) {
    throw new Error('Yalnızca JPEG ve PNG fotoğrafları yüklenebilir.');
  }

  if (
    attachment.fileSize < 1 ||
    attachment.fileSize > 5 * 1024 * 1024
  ) {
    throw new Error('Fotoğraf boyutu 5 MB sınırını aşamaz.');
  }

  const extension =
    attachment.mimeType === 'image/png' ? 'png' : 'jpg';

  const randomId = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;

  const storagePath = `${ticketId}/${user.id}/${randomId}.${extension}`;

  const response = await fetch(attachment.uri);

  if (!response.ok) {
    throw new Error('Fotoğraf dosyası okunamadı.');
  }

  const fileData = await response.arrayBuffer();

  if (fileData.byteLength !== attachment.fileSize) {
    throw new Error('Fotoğraf dosyasının boyutu doğrulanamadı.');
  }
  console.log('Attachment upload debug:', {
  ticketId,
  userId: user.id,
  storagePath,
  mimeType: attachment.mimeType,
  fileSize: attachment.fileSize,
});

console.log('Ticket access RPC başladı');

try {
  const { data: canAccess, error: accessError } = await supabase.rpc(
    'can_access_ticket',
    {
      p_ticket_id: ticketId,
    },
  );

  console.log('Ticket access RPC tamamlandı:', {
    canAccess,
    accessError,
  });
} catch (error) {
  console.log('Ticket access RPC exception:', error);
}

const { data: ticket, error: ticketError } = await supabase
  .from('tickets')
  .select('id, status')
  .eq('id', ticketId)
  .single();

console.log('Ticket status debug:', {
  ticket,
  ticketError,
});

const { data: policyDebug, error: policyDebugError } =
  await supabase.rpc('debug_ticket_attachment_policy', {
    p_ticket_id: ticketId,
    p_storage_path: storagePath,
  });

console.log('Storage policy condition debug:', {
  policyDebug,
  policyDebugError,
});



const { error: uploadError } = await supabase.storage
  .from('ticket-attachments')
  .upload(storagePath, fileData, {
    contentType: attachment.mimeType,
    upsert: false,
    metadata: {
      mimetype: attachment.mimeType,
      size: attachment.fileSize,
    },
  });
 console.log('Storage upload error details:', {
  name: uploadError?.name,
  message: uploadError?.message,
  statusCode: uploadError?.statusCode,
  error: uploadError,
});

  if (uploadError) {
    throw new Error(`Fotoğraf yüklenemedi: ${uploadError.message}`);
  }

  const { error: attachmentError } = await supabase.rpc(
    'create_ticket_attachment',
    {
      p_ticket_id: ticketId,
      p_storage_path: storagePath,
      p_mime_type: attachment.mimeType,
      p_file_size_bytes: attachment.fileSize,
    },
  );

  if (attachmentError) {
    // Metadata kaydı başarısızsa yüklenen dosyayı temizle.
    const { error: cleanupError } = await supabase.storage
      .from('ticket-attachments')
      .remove([storagePath]);

    if (cleanupError) {
      throw new Error(
        `Fotoğraf kaydı oluşturulamadı: ${attachmentError.message}. ` +
          `Geçici dosya temizlenemedi: ${cleanupError.message}`,
      );
    }

    throw new Error(
      `Fotoğraf kaydı oluşturulamadı: ${attachmentError.message}`,
    );
  }

  return storagePath;
}


export async function getTicketAttachments(
  ticketId: string,
): Promise<TicketAttachmentWithUrl[]> {
  const { data, error } = await supabase
    .from('ticket_attachments')
    .select(
      'id, ticket_id, storage_path, mime_type, file_size_bytes, created_at',
    )
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Servis fotoğrafları yüklenemedi: ${error.message}`);
  }

  const attachments = data ?? [];

  return Promise.all(
    attachments.map(async (attachment) => {
      const { data: signedUrlData, error: signedUrlError } =
        await supabase.storage
          .from('ticket-attachments')
          .createSignedUrl(attachment.storage_path, 60 * 60);

      if (signedUrlError) {
        throw new Error(
          `Fotoğraf görüntüleme bağlantısı oluşturulamadı: ${signedUrlError.message}`,
        );
      }

      return {
        ...attachment,
        signedUrl: signedUrlData.signedUrl,
      };
    }),
  );
}

