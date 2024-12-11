import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== 0) {
      const parent = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
      if (!parent) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parent.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileData = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? parentId : ObjectId(parentId),
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(fileData);
      return res.status(201).json({
        id: result.insertedId,
        userId: fileData.userId,
        name: fileData.name,
        type: fileData.type,
        isPublic: fileData.isPublic,
        parentId: fileData.parentId,
      });
    }

    const localPath = `${FOLDER_PATH}/${uuidv4()}`;
    const fileBuffer = Buffer.from(data, 'base64');

    try {
      if (!fs.existsSync(FOLDER_PATH)) {
        fs.mkdirSync(FOLDER_PATH, { recursive: true });
      }
      fs.writeFileSync(localPath, fileBuffer);
    } catch (error) {
      console.error('Error writing file:', error);
      return res.status(500).json({ error: 'Error saving file to disk' });
    }

    fileData.localPath = localPath;
    const result = await dbClient.db.collection('files').insertOne(fileData);

    return res.status(201).json({
      id: result.insertedId,
      userId: fileData.userId,
      name: fileData.name,
      type: fileData.type,
      isPublic: fileData.isPublic,
      parentId: fileData.parentId,
    });
  }

  static async getShow(req, res) {
    const token = req.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({
      _id: ObjectId(fileId),
      userId: ObjectId(userId),
    });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = req.query.parentId || 0;
    const page = parseInt(req.query.page, 10) || 0;
    const perPage = 20;
    const skip = page * perPage;

    const matchQuery = { userId: ObjectId(userId) };
    if (parentId !== 0) {
      matchQuery.parentId = ObjectId(parentId);
    } else {
      matchQuery.parentId = parentId;
    }

    const files = await dbClient.db.collection('files').aggregate([
      { $match: matchQuery },
      { $skip: skip },
      { $limit: perPage },
      {
        $project: {
          _id: 0,
          id: '$_id',
          userId: '$userId',
          name: '$name',
          type: '$type',
          isPublic: '$isPublic',
          parentId: '$parentId',
        },
      },
    ]).toArray();

    return res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const token = req.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOneAndUpdate(
      { _id: ObjectId(fileId), userId: ObjectId(userId) },
      { $set: { isPublic: true } },
      { returnDocument: 'after' }, // Return the updated document
    );

    if (!file.value) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json({
      id: file.value._id,
      userId: file.value.userId,
      name: file.value.name,
      type: file.value.type,
      isPublic: file.value.isPublic,
      parentId: file.value.parentId,
    });
  }

  static async putUnpublish(req, res) {
    const token = req.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOneAndUpdate(
      { _id: ObjectId(fileId), userId: ObjectId(userId) },
      { $set: { isPublic: false } },
      { returnDocument: 'after' }, // Return the updated document
    );

    if (!file.value) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json({
      id: file.value._id,
      userId: file.value.userId,
      name: file.value.name,
      type: file.value.type,
      isPublic: file.value.isPublic,
      parentId: file.value.parentId,
    });
  }

  static async getFile(req, res) {
    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    const {
      isPublic, userId, type, localPath,
    } = file;

    if (!isPublic) {
      const token = req.header('X-Token');
      if (!token) {
        return res.status(404).json({ error: 'Not found' });
      }
      const key = `auth_${token}`;
      const ownerId = await redisClient.get(key);
      if (!ownerId || ownerId !== userId.toString()) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    if (type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    if (!localPath || !fs.existsSync(localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const mimeType = mime.lookup(file.name);
    res.setHeader('Content-Type', mimeType);
    const fileStream = fs.createReadStream(localPath);
    fileStream.pipe(res);
    return res;
  }
}

export default FilesController;
