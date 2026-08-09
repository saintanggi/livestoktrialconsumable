// api/supabase.js
// Serverless API Proxy untuk mem-bypass pemblokiran Adblock Plus / Firewall IT kantor secara penuh
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Prefer'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { table, ...params } = req.query;
  if (!table) {
    return res.status(400).json({ error: 'Table parameter is required' });
  }

  const SUPABASE_URL = "https://qdljeibmnolizjprignz.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkbGplaWJtbm9saXpqcHJpZ256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjcyMDEsImV4cCI6MjEwMTYwMzIwMX0.Z7Gw29C8r8fbg-FcvGVGsBUw1Drt6FXqMmYsVkkSjHk";

  // Build the target URL for Supabase Rest API
  // Convert req.query params to Supabase URL Query
  const queryParams = new URL(SUPABASE_URL);
  queryParams.pathname = `/rest/v1/${table}`;
  
  for (const [key, value] of Object.entries(params)) {
    queryParams.searchParams.append(key, value);
  }
  queryParams.searchParams.append('apikey', SUPABASE_ANON_KEY);

  try {
    // Gunakan global fetch (bawaan Node.js 18+ di Vercel)
    const response = await fetch(queryParams.toString(), {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Prefer': req.headers['prefer'] || '',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: ['POST', 'PATCH', 'PUT'].includes(req.method) ? JSON.stringify(req.body) : null
    });

    const responseText = await response.text();
    let responseData = null;
    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch (e) {
      responseData = responseText;
    }

    res.status(response.status).json(responseData);
  } catch (error) {
    console.error('API Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
};
