import axios from 'axios';

export const repairShopr = {
  getCustomers: async (query?: string, page?: number) => {
    const response = await axios.get('/api/repairshopr/customers', { params: { query, page } });
    return response.data;
  },
  getCustomer: async (id: string | number) => {
    const response = await axios.get(`/api/repairshopr/customers/${id}`);
    return response.data;
  },
  updateCustomer: async (id: string | number, data: any) => {
    const response = await axios.put(`/api/repairshopr/customers/${id}`, data);
    return response.data;
  },
  getTickets: async (customerId?: string, query?: string) => {
    const response = await axios.get('/api/repairshopr/tickets', { params: { customer_id: customerId, query } });
    return response.data;
  },
  getTicket: async (id: string) => {
    const response = await axios.get(`/api/repairshopr/tickets/${id}`);
    return response.data;
  },
  deleteTicket: async (id: string | number) => {
    const response = await axios.delete(`/api/repairshopr/tickets/${id}`);
    return response.data;
  }
};

export const mobileMessage = {
  sendSms: async (to: string, message: string, customRef?: string, ticketId?: string) => {
    const response = await axios.post('/api/mobilemessage/send', { 
      to, 
      message, 
      custom_ref: customRef,
      ticket_id: ticketId 
    });
    return response.data;
  }
};
