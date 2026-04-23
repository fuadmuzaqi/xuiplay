import { db } from "./_lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    // 1. Ambil genre, urutkan berdasarkan sort_order yang baru kita buat
    const genresResult = await db.execute(`
      SELECT id, name, slug, created_at, sort_order
      FROM genres
      ORDER BY sort_order ASC, name ASC
    `);

    // 2. Ambil semua lagu, urutkan berdasarkan sort_order
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

    // 3. Mapping genre menjadi array objek dengan placeholder tracks
    const genres = genresResult.rows.map((genre) => ({
      id: Number(genre.id),
      name: genre.name,
      slug: genre.slug,
      sortOrder: Number(genre.sort_order || 0),
      createdAt: genre.created_at,
      tracks: []
    }));

    // 4. Masukkan ke dalam Map untuk mempercepat grouping lagu
    const grouped = new Map(genres.map((genre) => [genre.id, genre]));

    // 5. Masukkan lagu ke dalam genre yang sesuai
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

    // 6. Kirim respon final (Genre sudah terurut sesuai sort_order di admin)
    res.status(200).json({ genres });
  } catch (error) {
    console.error("Library error:", error);
    res.status(500).json({ error: "Failed to load library." });
  }
}
