const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db').promise;

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, role_id } = req.body;

    if (!email || !password || !name ) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const [existingUser] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const selectedRoleId = role_id || 1;

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role_id) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, selectedRoleId]
    );

    const [roleData] = await pool.query('SELECT role_name FROM roles WHERE id = ?', [selectedRoleId]);
    const roleName = roleData[0].role_name;

    // Auto-create profile row based on role so dashboard lookups succeed
    if (selectedRoleId === 1 || roleName === 'student') {
      const generatedStudentId = 'STU' + String(result.insertId).padStart(5, '0');
      await pool.query(
        'INSERT INTO students (name, email, contact, student_id) VALUES (?, ?, ?, ?)',
        [name, email, 0, generatedStudentId]
      ).catch(() => {});
    } else if (selectedRoleId === 2 || roleName === 'warden') {
      // Insert into warden table
      await pool.query(
        'INSERT INTO warden (name, email) VALUES (?, ?)',
        [name, email]
      ).catch(() => {});
    }

    const user = {
      id: result.insertId,
      email,
      role: roleName,
    };

    const token = generateToken(user);

    res.status(201).json({ message: 'Registered successfully', token, user });
  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


exports.login = async (req, res) => {
  try {
    console.log('LOGIN: handler entered, body:', JSON.stringify(req.body));
    const { email, password } = req.body;

    console.log('LOGIN: querying DB for email:', email);
    const [users] = await pool.query(
      `SELECT users.*, roles.role_name FROM users 
       JOIN roles ON users.role_id = roles.id 
       WHERE email = ?`, [email]
    );
    console.log('LOGIN: query returned', users.length, 'users');

    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    console.log('LOGIN: comparing password');
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('LOGIN: password match:', isMatch);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    console.log('LOGIN: generating token');
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role_name,
    });
    console.log('LOGIN: token generated OK');

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_name,
      },
    });
  } catch (err) {
    console.error('Login Error:', err.message, err.stack);
    res.status(500).json({ message: 'Internal Server Error', debug: err.message });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const [users] = await pool.query(
      `SELECT users.*, roles.role_name FROM users 
       JOIN roles ON users.role_id = roles.id 
       WHERE email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'User does not exist. Access denied.' });
    }

    const user = users[0];
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role_name,
    });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role_name,
      },
    });
  } catch (err) {
    console.error('Google Login Error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};











