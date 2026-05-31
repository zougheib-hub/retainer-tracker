const webpush = require('web-push');

module.exports = async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const getRes = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/push_data`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
    });
    const { result } = await getRes.json();
    if (!result) return res.status(200).json({ ok: true, message: 'No subscription' });

    const { subscription, currentRetainer, switchDate } = JSON.parse(result);

    const dubaiNow = new Date(Date.now() + 4 * 60 * 60
