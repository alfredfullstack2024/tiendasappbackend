const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración de Cloudinary para subir imágenes
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Configuración de multer para manejo de archivos
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Conexión a MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch((err) => console.error("❌ Error conectando a MongoDB:", err));

// =================== ESQUEMA DE LA TIENDA ===================
const reseñaSchema = new mongoose.Schema({
  usuario: { type: String, required: true, trim: true },
  comentario: { type: String, trim: true },
  calificacion: { type: Number, required: true, min: 1, max: 5 },
  fecha: { type: Date, default: Date.now },
});

const tiendaSchema = new mongoose.Schema({
  nombreEstablecimiento: { type: String, required: true, trim: true },
  direccion: { type: String, required: true, trim: true },
  categoria: {
    type: String,
    required: true,
    enum: [
      "Comidas y Restaurantes",
      "Tecnología y Desarrollo",
      "Gimnasios",
      "Papelería y Librerías",
      "Mascotas",
      "Odontología",
      "Ópticas",
      "Pastelerías",
      "Pizzerías",
      "Ropa de Niños",
      "Ropa de Mujeres",
      "Ropa Deportiva",
      "Salones de Belleza",
      "SPA",
      "Talleres de Mecánica",
      "Tiendas Deportivas",
      "Veterinarias",
      "Vidrierías",
    ],
  },
  telefonoWhatsapp: { type: String, required: true, trim: true },
  fotos: [{ url: String, public_id: String }],
  descripcionVentas: { type: String, required: true, trim: true },
  paginaWeb: { type: String, trim: true, default: "" },
  redesSociales: { type: String, trim: true, default: "" },
  fechaCreacion: { type: Date, default: Date.now },
  activa: { type: Boolean, default: true },
  reseñas: [reseñaSchema], // Subdocumento de reseñas
});

const Tienda = mongoose.model("Tienda", tiendaSchema);

// Función para subir imagen a Cloudinary
const subirImagenCloudinary = async (buffer, fileName) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "tiendasapp",
          public_id: fileName,
          transformation: [
            { width: 800, height: 600, crop: "fill", quality: "auto" },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      )
      .end(buffer);
  });
};

// =================== RUTAS DE LA API ===================

// Obtener todas las categorías
app.get("/api/categorias", (req, res) => {
  const categorias = [
    "Comidas y Restaurantes",
    "Tecnología y Desarrollo",
    "Gimnasios",
    "Papelería y Librerías",
    "Mascotas",
    "Odontología",
    "Ópticas",
    "Pastelerías",
    "Pizzerías",
    "Ropa de Niños",
    "Ropa de Mujeres",
    "Ropa Deportiva",
    "Salones de Belleza",
    "SPA",
    "Talleres de Mecánica",
    "Tiendas Deportivas",
    "Veterinarias",
    "Vidrierías",
  ];
  res.json(categorias);
});

// Registrar nueva tienda
app.post("/api/tiendas", upload.array("fotos", 3), async (req, res) => {
  try {
    const {
      nombreEstablecimiento,
      direccion,
      categoria,
      telefonoWhatsapp,
      descripcionVentas,
      paginaWeb,
      redesSociales,
    } = req.body;

    if (
      !nombreEstablecimiento ||
      !direccion ||
      !categoria ||
      !telefonoWhatsapp ||
      !descripcionVentas
    ) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const fotosSubidas = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const fileName = `${Date.now()}_${i}_${nombreEstablecimiento.replace(
          /\s+/g,
          "_"
        )}`;

        try {
          const resultado = await subirImagenCloudinary(file.buffer, fileName);
          fotosSubidas.push({
            url: resultado.secure_url,
            public_id: resultado.public_id,
          });
        } catch (error) {
          console.error(`❌ Error subiendo imagen ${i + 1}:`, error);
        }
      }
    }

    const nuevaTienda = new Tienda({
      nombreEstablecimiento,
      direccion,
      categoria,
      telefonoWhatsapp: telefonoWhatsapp.replace(/\D/g, ""),
      fotos: fotosSubidas,
      descripcionVentas,
      paginaWeb: paginaWeb || "",
      redesSociales: redesSociales || "",
    });

    const tiendaGuardada = await nuevaTienda.save();
    res.status(201).json({
      mensaje: "Tienda registrada exitosamente",
      tienda: tiendaGuardada,
    });
  } catch (error) {
    console.error("❌ Error registrando tienda:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Obtener tiendas por categoría
app.get("/api/tiendas/categoria/:categoria", async (req, res) => {
  try {
    const { categoria } = req.params;
    const tiendas = await Tienda.find({ categoria, activa: true }).sort({
      nombreEstablecimiento: 1,
    });
    res.json(tiendas);
  } catch (error) {
    console.error("❌ Error obteniendo tiendas por categoría:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Obtener tienda por ID
app.get("/api/tiendas/:id", async (req, res) => {
  try {
    const tienda = await Tienda.findById(req.params.id);
    if (!tienda) return res.status(404).json({ error: "Tienda no encontrada" });
    res.json(tienda);
  } catch (error) {
    console.error("❌ Error obteniendo tienda:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Obtener todas las tiendas
app.get("/api/tiendas", async (req, res) => {
  try {
    const tiendas = await Tienda.find({ activa: true }).sort({
      nombreEstablecimiento: 1,
    });
    res.json(tiendas);
  } catch (error) {
    console.error("❌ Error obteniendo tiendas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// =================== RUTAS DE RESEÑAS ===================

// Obtener reseñas de una tienda
app.get("/api/tiendas/:id/reviews", async (req, res) => {
  try {
    const tienda = await Tienda.findById(req.params.id).select("reseñas");
    if (!tienda) return res.status(404).json({ error: "Tienda no encontrada" });
    res.json(tienda.reseñas);
  } catch (error) {
    console.error("❌ Error obteniendo reseñas:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Agregar reseña a una tienda
app.post("/api/tiendas/:id/reviews", async (req, res) => {
  try {
    const { usuario, comentario, calificacion } = req.body;
    if (!usuario || !calificacion) {
      return res
        .status(400)
        .json({ error: "Usuario y calificación son obligatorios" });
    }

    const tienda = await Tienda.findById(req.params.id);
    if (!tienda) return res.status(404).json({ error: "Tienda no encontrada" });

    const nuevaReseña = { usuario, comentario, calificacion };
    tienda.reseñas.push(nuevaReseña);
    await tienda.save();

    res.status(201).json({ mensaje: "Reseña agregada con éxito", reseña: nuevaReseña });
  } catch (error) {
    console.error("❌ Error agregando reseña:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Ruta de salud
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Servidor funcionando correctamente",
    timestamp: new Date().toISOString(),
  });
});

// Manejo de rutas no encontradas
app.use("*", (req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API Categorías: http://localhost:${PORT}/api/categorias`);
});
