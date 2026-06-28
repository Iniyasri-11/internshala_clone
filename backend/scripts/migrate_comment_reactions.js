const mongoose = require('mongoose');
const Post = require('../Model/Post');
const { connect } = require('../db');

async function run() {
  await connect();
  console.log('Connected to DB');
  const posts = await Post.find({}).exec();
  console.log(`Found ${posts.length} posts`);
  let updated = 0;
  for (const post of posts) {
    let changed = false;
    if (Array.isArray(post.comments)) {
      for (const comment of post.comments) {
        if (typeof comment.upCount !== 'number') { comment.upCount = 0; changed = true; }
        if (typeof comment.downCount !== 'number') { comment.downCount = 0; changed = true; }
        if (!Array.isArray(comment.reactedBy)) { comment.reactedBy = []; changed = true; }
      }
    }
    if (changed) {
      await post.save();
      updated++;
    }
  }
  console.log(`Updated ${updated} posts`);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
