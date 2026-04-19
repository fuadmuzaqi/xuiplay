import { requireAdmin } from "../_lib/auth.js";
import { db } from "../_lib/db.js";
import { extractYouTubeVideoId, getJsonBody } from "../_lib/utils.js";

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === "GET") {
      const result = await db.execute(`
        SELECT
          t.id,
          t.genre_id,
          g.name AS genre_name,
          t.title,
          t.artist,
          t.youtube_url,
          t.youtube_video_id,
          t.cover_url,
          t.accent_color,
          t.sort_order,
          t.created_at
        FROM tracks t
        JOIN genres g ON g.id = t.genre_id
        ORDER BY g.name ASC, t.sort_order ASC, t.id DESC
      `);

      res.status(200).json({
        tracks: result.rows.map((row) => ({
          id: Number(row.id),
          genreId: Number(row.genre_id),
          genreName: row.genre_name,
          title: row.title,
          artist: row.artist,
          youtubeUrl: row.youtube_url,
          youtubeVideoId: row.youtube_video_id,
          coverUrl: row.cover_url,
          accentColor: row.accent_color,
          sortOrder: Number(row.sort_order),
          createdAt: row.created_at
        }))
      });
      return;
    }

    if (req.method === "POST") {
      const body = getJsonBody(req);

      const genreId = Number(body.genreId);
      const title = String(body.title || "").trim();
      const artist = String(body.artist || "").trim();
      const youtubeUrl = String(body.youtubeUrl || "").trim();
      const coverUrl = String(body.coverUrl || "").trim();
      const accentColor = String(body.accentColor || "#01696f").trim();
      const sortOrder = Number(body.sortOrder || 0);

      if (!genreId || !title || !youtubeUrl) {
        res.status(400).json({ error: "Genre, judul, dan link YouTube wajib diisi." });
        return;
      }

      const youtubeVideoId = extractYouTubeVideoId(youtubeUrl);
      if (!youtubeVideoId) {
        res.status(400).json({ error: "Link YouTube tidak valid." });
        return;
      }

      await db.execute({
        sql: `
          INSERT INTO tracks (
            genre_id,
            title,
            artist,
            youtube_url,
            youtube_video_id,
            cover_url,
            accent_color,
            sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          genreId,
          title,
          artist || null,
          youtubeUrl,
          youtubeVideoId,
          coverUrl || null,
          accentColor,
          Number.isFinite(sortOrder) ? sortOrder : 0
        ]
      });

      res.status(201).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    res.status(500).json({ error: "Gagal memproses track." });
  }
}
