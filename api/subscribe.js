module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subscription, currentRetainer, switchDate } = req.body || {};
    if (!subscription || !switchDate) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const value = JSON.stringify({ subscription, currentRetainer, switchDate });

    const r = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/set/push_data`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      body: value
    });
    if (!r.ok) throw new Error('Upstash set failed: ' + r.status);

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: err.message });
  }
};
