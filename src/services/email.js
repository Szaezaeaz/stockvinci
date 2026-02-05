import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_8vfoslp';
const TEMPLATE_ID = 'template_klus6n3';
const PUBLIC_KEY = 'Aku_0MqsqAEqcrLBk';

export const sendLowStockAlert = (item, count) => {
    // Only send for Casques for now, as requested
    if (item !== 'Casque') return;

    // Prevent spamming locally? (Optional, skipping for simplicity/reliability first)
    // We rely on the fact that this function is called only when stock updates.

    const templateParams = {
        item: item,
        count: count,
        message: `Attention, le stock de ${item} est critique ! Il ne reste que ${count} unités.`
    };

    emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)
        .then((response) => {
            console.log('Email sent successfully!', response.status, response.text);
        })
        .catch((err) => {
            console.error('Failed to send email:', err);
        });
};
