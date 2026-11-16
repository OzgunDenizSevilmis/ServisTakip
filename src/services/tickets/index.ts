export {
  createTicket,
  getActiveCategories,
  getMyTickets,
} from './ticketService';

export type {
  CreateTicketInput,
  TicketCategory,
  TicketListItem,
  TicketPriority,
  TicketStatus,
} from './ticketService';
export {
  uploadTicketAttachment,
} from './ticketService';

export type {
  TicketAttachmentInput,
  TicketAttachment,
} from './ticketService';

export { getTicketAttachments } from './ticketService';