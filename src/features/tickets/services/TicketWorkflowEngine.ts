import { db } from "../../../firebase";
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import axios from "axios";
import { TICKET_PIPELINE } from "../../../hooks/useTicketData";
import { companyDoc } from "../../../lib/companyFirestore";

export class TicketWorkflowEngine {
  static async updateStatus(ticketId: string, newStatus: string, currentStatus: string, customerId?: string) {
    if (newStatus === currentStatus) return { success: true };
    
    try {
      await updateDoc(companyDoc("crm_tickets", ticketId), {
        status: newStatus,
        updated_at: new Date().toISOString()
      });
      
      // Auto-trigger SMS Feature via templates
      if (customerId) {
         await this.triggerWorkflowAutomation(ticketId, newStatus, customerId);
      }

      return { success: true };
    } catch (err: any) {
      console.error("Failed to update status", err);
      throw new Error(`Failed to update status: ${err.message}`);
    }
  }

  static async triggerWorkflowAutomation(ticketId: string, newStatus: string, customerId: string) {
    try {
      const smsTemplateDoc = await getDoc(companyDoc("sms_templates", newStatus));
      if (smsTemplateDoc.exists()) {
        const templateStr = smsTemplateDoc.data().message as string;
        if (templateStr) {
          const customerDoc = await getDoc(companyDoc("crm_customers", customerId));
          if (customerDoc.exists()) {
            const cust = customerDoc.data();
            const phone = cust.mobile || cust.phone;
            
            if (phone) {
               // Get Ticket details for interpolation
               const ticketDoc = await getDoc(companyDoc("crm_tickets", ticketId));
               const ticketData = ticketDoc.exists() ? ticketDoc.data() : null;

               let messageBody = templateStr
                 .replace(/{customer_name}/g, cust.fullname || cust.firstname || 'Customer')
                 .replace(/{ticket_number}/g, ticketData?.number?.toString() || ticketId)
                 .replace(/{shop_name}/g, "PhoneMedic");
                 
               await axios.post('/api/mobilemessage/send', {
                 to: phone,
                 message: messageBody,
                 customerId: customerId,
                 customerName: cust.fullname || cust.firstname,
                 isInternal: false
               });
            }
          }
        }
      }
    } catch (err) {
       console.error("SMS automation error", err);
    }
  }
}
