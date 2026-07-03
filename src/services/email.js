import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_8vfoslp';
const TEMPLATE_ID = 'template_klus6n3';
const PUBLIC_KEY = 'Aku_0MqsqAEqcrLBk';

export const sendLowStockAlert = (item, count) => {
    // Prevent spamming locally? (Optional, skipping for simplicity/reliability first)
    // We rely on the fact that this function is called only when stock updates.

    const templateParams = {
        to_email: 'yanis.cones-ext@vinci-construction.com',
        subject: `ATTENTION ! Plus que ${count} ${item} dans le stock, prévoir une commande.`,
        item: item,
        count: count,
        message: `ATTENTION !

Plus que ${count} ${item} dans le stock, prévoir une commande.`
    };

    emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)
        .then((response) => {
            console.log('Email sent successfully!', response.status, response.text);
        })
        .catch((err) => {
            console.error('Failed to send email:', err);
        });
};
