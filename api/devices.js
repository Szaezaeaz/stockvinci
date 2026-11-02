import { authenticate, cleanLabel, publicDevice, saveDevices, send, serverConfigured } from '../server/auth.js';

// Appareils autorisés à se connecter (administrateurs seulement).
//   GET -> { devices, currentId }
//   POST { action: 'approve' | 'remove' | 'rename', id, label? } -> { devices, currentId }
// 'remove' refuse une demande ou retire l'autorisation : les sessions de l'appareil sont coupées.
export default async function handler(req, res) {
    if (!serverConfigured()) return send(res, 503, { error: 'not_configured' });

    try {
        const { user, device: current, devices } = await authenticate(req);
        if (!user) return send(res, 401, { error: 'unauthorized' });
        if (user.role !== 'admin') return send(res, 403, { error: 'forbidden' });

        const reply = (list) => send(res, 200, { devices: list.map(publicDevice), currentId: current.id });

        if (req.method === 'GET') return reply(devices);
        if (req.method !== 'POST') {
            res.setHeader('Allow', 'GET, POST');
            return send(res, 405, { error: 'method_not_allowed' });
        }

        const { action, id, label } = req.body || {};
        const target = devices.find(device => device.id === id);
        if (!target) return send(res, 404, { error: 'not_found' });

        let next;
        if (action === 'approve') {
            next = devices.map(device => (device.id === id ? { ...device, status: 'approved', approvedBy: user.name } : device));
        } else if (action === 'remove') {
            if (id === current.id) return send(res, 409, { error: 'own_device' });
            next = devices.filter(device => device.id !== id);
        } else if (action === 'rename') {
            const clean = cleanLabel(label);
            if (!clean) return send(res, 400, { error: 'bad_name' });
            next = devices.map(device => (device.id === id ? { ...device, label: clean } : device));
        } else {
            return send(res, 400, { error: 'bad_action' });
        }
        await saveDevices(next);
        return reply(next);
    } catch (err) {
        console.error('devices api error', err);
        return send(res, 500, { error: 'server_error' });
    }
}
