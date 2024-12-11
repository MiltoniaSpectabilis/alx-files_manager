import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');

fileQueue.process(async (job, done) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    done(new Error('Missing fileId'));
    return;
  }
  if (!userId) {
    done(new Error('Missing userId'));
    return;
  }

  const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });

  if (!file) {
    done(new Error('File not found'));
    return;
  }

  const { localPath } = file;

  try {
    const thumbnail500 = await imageThumbnail(localPath, { width: 500 });
    const thumbnail250 = await imageThumbnail(localPath, { width: 250 });
    const thumbnail100 = await imageThumbnail(localPath, { width: 100 });

    fs.writeFileSync(`${localPath}_500`, thumbnail500);
    fs.writeFileSync(`${localPath}_250`, thumbnail250);
    fs.writeFileSync(`${localPath}_100`, thumbnail100);

    done();
  } catch (error) {
    done(error);
  }
});
