const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express()
const port = process.env.PORT || 3000;
const SECRET_KEY = "secret_key_for_571";
const MONGO_URI = "mongodb+srv://david:020710@cluster0.83tpn.mongodb.net/?appName=Cluster0";
const ARTSY_API_BASE = "https://api.artsy.net/api";
const ARTSY_CLIENT_ID = "54669836254db2195fbd";
const ARTSY_CLIENT_SECRET = "e2d4bcdc59135170457c3760681a0a93";

let artsyToken = null;
let expiresAt = null;

app.use(cors({
  origin: ['http://localhost:4200'],
  credentials: true
}));
app.use(express.json());

const client = new MongoClient(MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function connectDB() {
  try {
    await client.connect();
    await client.db("mydatabase").command({ ping: 1 });
    console.log("Connected to MongoDB successfully!");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
}

connectDB();
const db = client.db("Assignment4");
const usersCollection = db.collection("users");
const favoritesCollection = db.collection('favorites');

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex'); 
}

function authenticateToken(req, res, next) {
  const cookie = req.headers.cookie;
  const token = cookie?.split('=')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }

    req.userId = decoded.userId;
    next();
  });
}

async function getValidArtsyToken() {
  const now = new Date();
  
  if (artsyToken && expiresAt && now < expiresAt) {
      return artsyToken;
  }

  console.log("Fetching new Artsy token...");

  try {
      const response = await axios.post(`${ARTSY_API_BASE}/tokens/xapp_token`, {
          client_id: ARTSY_CLIENT_ID,
          client_secret: ARTSY_CLIENT_SECRET
      });

      artsyToken = response.data.token;
      expiresAt = new Date(response.data.expires_at);

      console.log("New Artsy token acquired, expires at:", expiresAt);
      return artsyToken;
  } catch (error) {
      console.error("Error fetching Artsy token:", error.response?.data || error.message);
      throw new Error("Failed to fetch Artsy token");
  }
}

app.post('/api/register', async (req, res) => {
  try {
      const { fullname, email, password } = req.body;

      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
          return res.status(400).json({ message: "Email already exists" });
      }

      const salt = generateSalt();
      const hashedPassword = hashPassword(password, salt);
      const emailHash = crypto.createHash('sha1').update(email.trim().toLowerCase()).digest('hex');
      const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?s=200&d=identicon`;
      const result = await usersCollection.insertOne({ email, fullname, password: hashedPassword, salt: salt, avatarUrl: gravatarUrl});
      const newUserId = result.insertedId;
      const token = jwt.sign({ userId: newUserId, email: email }, SECRET_KEY, { expiresIn: "1h" });
      
      res.cookie('authorization', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3600000,
        path: '/'
      });

      res.json({ message: "User registered successful", fullname: fullname, avatarUrl: gravatarUrl });
  } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/delete', authenticateToken, async (req, res) => {
  try {
      const id = new ObjectId(req.userId);
      const existingUser = await usersCollection.findOne({ _id: id });
      if (!existingUser) {
          return res.status(404).json({ message: "User not exists" });
      }
      await usersCollection.deleteOne({ _id: id });

      res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
      res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/login', async (req, res) => {
  try {
      const { email, password } = req.body;
      const user = await usersCollection.findOne({ email });
      if (!user) return res.status(401).json({ message: "Invalid Email or password" });
      const hashedInputPassword = hashPassword(password, user.salt);
      if (hashedInputPassword !== user.password) {
        return res.status(401).json({ message: "Invalid Email or password" });
      }

      const token = jwt.sign({ userId: user._id, email: user.email }, SECRET_KEY, { expiresIn: "1h" });
      res.cookie('authorization', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3600000,
        path: '/'
      });

      res.json({ message: "Login successful", fullname: user.fullname, avatarUrl: user.avatarUrl });
  } catch (err) {
      console.log(err)
      res.status(500).json({ message: "Server error" });
  }
});

app.post('/api/logout', async (req, res) => {
  res.clearCookie('authorization');
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const id = new ObjectId(req.userId);
    const existingUser = await usersCollection.findOne({ _id: id });
    if (!existingUser) {
        return res.status(404).json({ message: "User not exists" });
    }
    res.json({ message: "User check successfully", fullname: existingUser.fullname, avatarUrl: existingUser.avatarUrl });
} catch (err) {
    res.status(500).json({ message: "Server error" });
}
});

app.get('/api/search', async (req, res) => {
  try {
      const query = req.query.q;
      if (!query) {
          return res.status(400).json({ message: 'Query parameter "q" is required' });
      }

      const token = await getValidArtsyToken();
      const url = `${ARTSY_API_BASE}/search?q=${encodeURIComponent(query)}&type=artist&size=10`;

      const response = await axios.get(url, {
          headers: { 'X-Xapp-Token': token }
      });

      const searchResults = response.data._embedded.results;

      const formattedResults = searchResults.map(artist => {
        const selfLink = artist._links.self.href;
        const id = selfLink.substring(selfLink.lastIndexOf('/') + 1);
        return {
          id: id,
          name: artist.title,
          selfLink: selfLink,
          imageUrl: artist._links.thumbnail?.href || '/assets/shared/missing_image.png'
        };
      });

      res.json(formattedResults);
  } catch (err) {
      console.error("Error fetching search results:", err.response?.data || err.message);
      res.status(500).json({ message: 'Error fetching search results' });
  }
});

app.get('/api/details', async (req, res) => {
  try {
    const artistId = req.query.id;
    if (!artistId) {
      return res.status(400).json({ message: 'Artist ID is required' });
    }

    const token = await getValidArtsyToken();
    const headers = { 'X-Xapp-Token': token };

    const artistResponse = await axios.get(`${ARTSY_API_BASE}/artists/${artistId}`, { headers });
    const name = artistResponse.data.name;
    const bio = artistResponse.data.biography?.replace(/-\s+/g, '').replace(/[\u0096]/g, '-');
    const birthday = artistResponse.data.birthday;
    const deathday = artistResponse.data.deathday;
    const nationality = artistResponse.data.nationality;
    const imageUrl = artistResponse.data._links.thumbnail?.href || '/assets/shared/missing_image.png'

    const artworksResponse = await axios.get(`${ARTSY_API_BASE}/artworks?artist_id=${artistId}&size=10`, { headers });
    const artworks = artworksResponse.data._embedded.artworks.map(artwork => ({
      id: artwork.id,
      title: artwork.title,
      category: artwork.category,
      date: artwork.date,
      imageUrl: artwork._links.thumbnail ? artwork._links.thumbnail.href : '/assets/shared/missing_image.png'
    }));
    res.json({ name, bio, birthday, imageUrl, deathday, nationality, artworks });
  } catch (error) {
    console.error('Error fetching artist details:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/similar', async (req, res) => {
  try {
    const artistId = req.query.id;
    if (!artistId) {
      return res.status(400).json({ message: 'Artist ID is required' });
    }

    const token = await getValidArtsyToken();
    const headers = { 'X-Xapp-Token': token };

    const artistResponse = await axios.get(`${ARTSY_API_BASE}/artists?similar_to_artist_id=${artistId}`, { headers });
    const searchResults = artistResponse.data._embedded.artists;

    const formattedResults = searchResults.map(artist => {
      const selfLink = artist._links.self.href;
      const id = selfLink.substring(selfLink.lastIndexOf('/') + 1);
      return {
        id: id,
        name: artist.name,
        selfLink: selfLink,
        imageUrl: artist._links.thumbnail?.href || '/assets/shared/missing_image.png'
      };
    });

    res.json(formattedResults);
  } catch (error) {
    console.error('Error fetching similar artists:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/genes', async (req, res) => {
  try {
    const artworkId = req.query.artworkId;
    if (!artworkId) {
      return res.status(400).json({ message: 'Artwork ID is required' });
    }

    const token = await getValidArtsyToken();
    const headers = { 'X-Xapp-Token': token };
    const geneResponse = await axios.get(`${ARTSY_API_BASE}/genes?artwork_id=${artworkId}`, { headers });
    const searchResults = geneResponse.data._embedded.genes;

    const formattedResults = searchResults.map(gene => {
      return {
        name: gene.name,
        info: gene.description? gene.description : '' ,
        imageUrl: gene._links.thumbnail?.href || '/assets/shared/missing_image.png'
      };
    });

    res.json(formattedResults);
  } catch (error) {
    console.error('Error fetching genes:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/favorites/list', authenticateToken, async (req, res) => {
  try {
    const favoritesCollection = db.collection('favorites');
    const userFavorites = await favoritesCollection.findOne({ userId: req.userId });

    if (!userFavorites || !userFavorites.favorites) {
      return res.json([]);
    }

    res.json(userFavorites.favorites);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
})

app.get('/api/favorites/isFavorite', authenticateToken, async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ message: 'Missing artistId' });
    }

    const favoritesCollection = db.collection('favorites');
    const userFavorites = await favoritesCollection.findOne({ userId: req.userId });

    if (!userFavorites || !userFavorites.favorites) {
      return res.json(false);
    }

    const isFavorite = userFavorites.favorites.some(fav => String(fav.id) === id);

    res.json(isFavorite);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


app.post('/api/favorites/add', authenticateToken, async (req, res) => {
  const { id, name, imageUrl } = req.body;
  const userId = req.userId;

  if (!id || !name) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }

  try {
    let userFavorites = await favoritesCollection.findOne({ userId: userId });
  
    if (!userFavorites) {
      userFavorites = {
        userId: userId,
        favorites: []
      };
      await favoritesCollection.insertOne(userFavorites);
    }
  
    const existingFavorite = userFavorites.favorites.some(fav => fav.id === id);

    if (existingFavorite) {
      return res.status(400).json({ message: 'This artist is already in your favorites' });
    }

    const token = await getValidArtsyToken();
    const headers = { 'X-Xapp-Token': token };
    const artistResponse = await axios.get(`${ARTSY_API_BASE}/artists/${id}`, { headers });
    const birthday = artistResponse.data.birthday;
    const deathday = artistResponse.data.deathday;
    const nationality = artistResponse.data.nationality;
    const timestamp = new Date().toISOString();
    userFavorites.favorites.push({ id, name, imageUrl, birthday, deathday, nationality, timestamp });

    await favoritesCollection.updateOne({ userId: userId }, { $set: { favorites: userFavorites.favorites } });
    return res.status(200).json({ message: 'Artist added to favorites' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


app.post('/api/favorites/remove', authenticateToken, async (req, res) => {
  const { id } = req.body;
  const userId = req.userId;

  if (!id) {
    return res.status(400).json({ message: 'Artist ID is required' });
  }

  try {
    let userFavorites = await favoritesCollection.findOne({ userId: userId });
  
    if (!userFavorites) {
      return res.status(404).json({ message: 'No favorites found for this user' });
    }
  
    userFavorites.favorites = userFavorites.favorites.filter(fav => fav.id !== id);
    
    await favoritesCollection.updateOne({ userId: userId }, { $set: { favorites: userFavorites.favorites } });
    
    return res.status(200).json({ message: 'Artist removed from favorites' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(port, () => {
  console.log('Server started at http://localhost:' + port);
})