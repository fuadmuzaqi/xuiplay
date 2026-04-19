import { db } from "./_lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const genresResult = await db.execute(`
      SELECT id, name, slug, created_at
      FROM genres
      ORDER BY name ASC
    `);

    const tracksResult = await db.execute(`
      SELECT
        id,
        genre_id,
        title,
        artist,
        youtube_url,
        youtube_video_id,
        cover_url,
        accent_color,
        sort_order,
        created_at
      FROM tracks
      ORDER BY sort_order ASC, id DESC
    `);

    const genres = genresResult.rows.map((genre) => ({
      id: Number(genre.id),
      name: genre.name,
      slug: genre.slug,
      createdAt: genre.created_at,
      tracks: []
    }));

    const grouped = new Map(genres.map((genre) => [genre.id, genre]));

    tracksResult.rows.forEach((track) => {
      const genre = grouped.get(Number(track.genre_id));
      if (!genre) return;

      genre.tracks.push({
        id: Number(track.id),
        genreId: Number(track.genre_id),
        title: track.title,
        artist: track.artist,
        youtubeUrl: track.youtube_url,
        youtubeVideoId: track.youtube_video_id,
        coverUrl: track.cover_url,
        accentColor: track.accent_color,
        sortOrder: Number(track.sort_order),
        createdAt: track.created_at
      });
    });

    res.status(200).json({ genres });
  } catch (error) {
    res.status(500).json({ error: "Failed to load library." });
  }
}
