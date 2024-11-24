const express = require('express');
const router = express.Router();
const connection = require('../db/mysql/index');
const dayjs = require('dayjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = 'uploads/';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  })
});

// 查询所有联系人接口（可模糊查询姓名、手机号码，可日区间查询）
router.get('/all', (req, res) => {
  let query = 'SELECT * FROM contacts';
  if (req.query.name) {
    query += ` WHERE name LIKE '%${req.query.name}%'`;
  }
  if (req.query.phone) {
    if (query.includes('WHERE')) {
      query += ` AND phone LIKE '%${req.query.phone}%'`;
    } else {
      query += ` WHERE phone LIKE '%${req.query.phone}%'`;
    }
  }
  if (req.query.startDate && req.query.endDate) {
    if (query.includes('WHERE')) {
      query += ` AND birthday BETWEEN '${req.query.startDate}' AND '${req.query.endDate}'`;
    } else {
      query += ` WHERE birthday BETWEEN '${req.query.startDate}' AND '${req.query.endDate}'`;
    }
  }
  connection.query(query, (err, results) => {
    if (err) {
      res.status(500).send('Error retrieving contacts from database');
      return;
    }
    res.send(results);
  });
});

// 分页查询接口（可模糊查询姓名、手机号码，可生日区间查询）
router.get('/page', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  // 构建基础查询语句和总数查询语句
  let baseQuery = 'SELECT * FROM contacts';
  let countQuery = 'SELECT COUNT(*) AS total FROM contacts';
  const conditions = [];

  // 根据查询参数添加条件
  if (req.query.name) {
    conditions.push(`name LIKE '%${req.query.name}%'`);
  }
  if (req.query.phone) {
    conditions.push(`phone LIKE '%${req.query.phone}%'`);
  }
  if (req.query.startDate && req.query.endDate) {
    conditions.push(`birthday BETWEEN '${req.query.startDate}' AND '${req.query.endDate}'`);
  }

  // 将条件追加到查询语句中
  if (conditions.length > 0) {
    const whereClause = ' WHERE ' + conditions.join(' AND ');
    baseQuery += whereClause;
    countQuery += whereClause;
  }

  // 添加分页条件
  baseQuery += ` LIMIT ${limit} OFFSET ${offset}`;

  // 执行总数查询和分页数据查询
  connection.query(countQuery, (countErr, countResults) => {
    if (countErr) {
      res.status(500).send('Error retrieving total count from database');
      return;
    }
    const total = countResults[0].total;

    connection.query(baseQuery, (dataErr, dataResults) => {
      if (dataErr) {
        res.status(500).send('Error retrieving contacts from database');
        return;
      }
      res.send({
        total,
        data: dataResults,
        page,
        limit,
      });
    });
  });
});

// 获取收藏联系人列表接口
router.get('/favorites', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  // 构建基础查询语句和总数查询语句
  let baseQuery = 'SELECT * FROM contacts WHERE is_favorite = 1';
  let countQuery = 'SELECT COUNT(*) AS total FROM contacts WHERE is_favorite = 1';
  const conditions = [];

  // 根据查询参数添加条件
  if (req.query.name) {
    conditions.push(`name LIKE '%${req.query.name}%'`);
  }
  if (req.query.phone) {
    conditions.push(`phone LIKE '%${req.query.phone}%'`);
  }
  if (req.query.startDate && req.query.endDate) {
    conditions.push(`birthday BETWEEN '${req.query.startDate}' AND '${req.query.endDate}'`);
  }

  // 将条件追加到查询语句中
  if (conditions.length > 0) {
    const whereClause = ' AND ' + conditions.join(' AND ');
    baseQuery += whereClause;
    countQuery += whereClause;
  }

  // 添加分页条件
  baseQuery += ` LIMIT ${limit} OFFSET ${offset}`;

  // 执行总数查询和分页数据查询
  connection.query(countQuery, (countErr, countResults) => {
    if (countErr) {
      res.status(500).send('Error retrieving total count from database');
      return;
    }
    const total = countResults[0].total;

    connection.query(baseQuery, (dataErr, dataResults) => {
      if (dataErr) {
        res.status(500).send('Error retrieving contacts from database');
        return;
      }
      res.send({
        total,
        data: dataResults,
        page,
        limit,
      });
    });
  });
});

// 添加联系人接口
router.post('/add', express.json(), (req, res) => {
  const { name, phone, backup_phone, address, email, birthday, social_media } = req.body;
  let formattedBirthday = null;
  if (birthday) {
    formattedBirthday = dayjs(birthday).format('YYYY-MM-DD');
  }
  const query = 'INSERT INTO contacts (name, phone, backup_phone, address, email, birthday, social_media) VALUES (?,?,?,?,?,?,?)';

  connection.query(query, [name, phone, backup_phone, address, email, formattedBirthday, social_media], (err, result) => {
    if (err) {
      console.log(err, 'err');
      res.status(500).send('Error adding contact to database');
      return;
    }
    res.send({ id: result.insertId });
  });
});

// 获取联系人详情接口
router.get('/:id', (req, res) => {
  const id = req.params.id;
  const query = 'SELECT * FROM contacts WHERE id = ?';
  
  connection.query(query, [id], (err, results) => {
    if (err) {
      res.status(500).send('Error retrieving contact from database');
      return;
    }
    if (results.length === 0) {
      res.status(404).send('Contact not found');
      return;
    }
    res.send(results[0]);
  });
});

// 更新联系人接口
router.put('/update', express.json(), (req, res) => {
  const { id, name, phone, backup_phone, address, email, birthday, social_media } = req.body;
  let formattedBirthday = null;
  if (birthday) {
    formattedBirthday = dayjs(birthday).format('YYYY-MM-DD');
  }
  const query = 'UPDATE contacts SET name=?, phone=?, backup_phone=?, address=?, email=?, birthday=?, social_media=? WHERE id=?';
  connection.query(query, [name, phone, backup_phone, address, email, formattedBirthday, social_media, id], (err) => {
    if (err) {
      res.status(500).send('Error updating contact in database');
      return;
    }
    res.sendStatus(200);
  });
});

// 收藏联系人接口
router.put('/favorite/:id', (req, res) => {
  const id = req.params.id;
  const query = 'UPDATE contacts SET is_favorite = 1 WHERE id = ?';
  
  connection.query(query, [id], (err) => {
    if (err) {
      res.status(500).send('Error setting contact as favorite');
      return;
    }
    res.sendStatus(200);
  });
});

// 取消收藏联系人接口
router.put('/unfavorite/:id', (req, res) => {
  const id = req.params.id;
  const query = 'UPDATE contacts SET is_favorite = 0 WHERE id = ?';
  
  connection.query(query, [id], (err) => {
    if (err) {
      res.status(500).send('Error removing contact from favorites');
      return;
    }
    res.sendStatus(200);
  });
});

// 删除联系人接口
router.delete('/delete/:id', (req, res) => {
  const ids = req.params.id.split(',');
   if (ids.length === 0) {
    res.status(400).send('Invalid request: No IDs provided for deletion');
    return;
  }
  
  const query = `DELETE FROM contacts WHERE id IN (${ids.map(() => '?').join(', ')})`;
  connection.query(query, ids, (err) => {
    if (err) {
      res.status(500).send('Error deleting contacts from database');
      return;
    }
    res.sendStatus(200);
  });
});

module.exports = router;