const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================================
// CONFIGURACIÓN
// =====================================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(helmet());

app.use(
  cors({
    origin: "*",
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// =====================================================
// MULTER
// =====================================================
// Una sola fotografía y máximo 5 MB

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Solo se permiten imágenes"));
    }

    cb(null, true);
  },
});

// =====================================================
// CONEXIÓN MONGODB
// =====================================================

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("=================================");
    console.log("✅ CONECTADO A MONGODB");
    console.log("=================================");
  })
  .catch((error) => {
    console.error("❌ ERROR MONGODB:", error);
  });


// =====================================================
// MUNICIPIOS HABILITADOS
// =====================================================

const MUNICIPIOS = [
  "Armenia",
  "Bagadó",
  "Bugalagrande",
  "Cali",
  "Cartago",
  "Certegui",
  "Condoto",
  "Dosquebradas",
  "El Cantón de San Pablo",
  "La Tebaida",
  "La Unión",
  "La Victoria",
  "Manizales",
  "Montenegro",
  "Novita",
  "Pereira",
  "Quibdó",
  "Roldanillo",
  "Salento",
  "San Francisco",
  "San José del Palmar",
  "Subachoque",
  "Tabio",
  "Tadó",
  "Toro",
  "Tuluá",
  "Viterbo",
  "Zarzal",
];


// =====================================================
// TIPOS DE REPORTE
// =====================================================

const TIPOS_REPORTE = [
  "Necesito ayuda",
  "Daños en mi vivienda",
  "Persona no localizada",
  "Estoy a salvo",
  "Quiero ofrecer ayuda",
  "Otro reporte",
];


// =====================================================
// SCHEMA REPORTE
// =====================================================

const emergenciaSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    ciudad: {
      type: String,
      required: true,
      trim: true,
      enum: MUNICIPIOS,
    },

    direccion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },

    tipoReporte: {
      type: String,
      required: true,
      enum: TIPOS_REPORTE,
    },

    telefonoWhatsapp: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },

    estadoVivienda: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    personasAfectadas: {
      type: Number,
      default: 1,
      min: 1,
      max: 1000,
    },

    necesidades: {
      type: [String],
      default: [],
    },

    descripcion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // =================================================
    // FOTO
    // SOLO SE UTILIZA PARA PERSONA NO LOCALIZADA
    // =================================================

    foto: {
      url: {
        type: String,
        default: "",
      },

      public_id: {
        type: String,
        default: "",
      },
    },

    // =================================================
    // UBICACIÓN PARA FUTURO MAPA
    // =================================================

    latitud: {
      type: Number,
      default: null,
    },

    longitud: {
      type: Number,
      default: null,
    },

    // =================================================
    // CONTROL
    // =================================================

    activa: {
      type: Boolean,
      default: true,
    },

    fechaCreacion: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);


// Índices para poder generar estadísticas rápidamente

emergenciaSchema.index({
  ciudad: 1,
  tipoReporte: 1,
});

emergenciaSchema.index({
  fechaCreacion: -1,
});

emergenciaSchema.index({
  activa: 1,
});


const Emergencia = mongoose.model(
  "Emergencia",
  emergenciaSchema
);


// =====================================================
// CLOUDINARY
// =====================================================

const subirFotoEmergencia = async (
  buffer,
  reporteId
) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          // Cada reporte tendrá su propia carpeta
          folder: `tiendasapp/emergencias/${reporteId}`,

          public_id: "persona",

          resource_type: "image",

          transformation: [
            {
              width: 1000,
              height: 1000,
              crop: "limit",
            },
            {
              quality: "auto",
            },
          ],
        },

        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      )
      .end(buffer);
  });
};


// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    servicio: "Sistema de Ayuda Ciudadana",
    fecha: new Date().toISOString(),
  });
});


// =====================================================
// MUNICIPIOS
// =====================================================

app.get("/api/municipios", (req, res) => {
  res.json(MUNICIPIOS);
});


// =====================================================
// TIPOS DE REPORTE
// =====================================================

app.get("/api/tipos-reporte", (req, res) => {
  res.json(TIPOS_REPORTE);
});


// =====================================================
// CREAR REPORTE
// =====================================================

app.post(
  "/api/emergencias",
  upload.single("foto"),
  async (req, res) => {
    try {
      const {
        nombre,
        ciudad,
        direccion,
        tipoReporte,
        telefonoWhatsapp,
        estadoVivienda,
        personasAfectadas,
        necesidades,
        descripcion,
        latitud,
        longitud,
      } = req.body;


      // =================================================
      // VALIDACIONES
      // =================================================

      if (!nombre || !nombre.trim()) {
        return res.status(400).json({
          error: "El nombre es obligatorio",
        });
      }

      if (!ciudad) {
        return res.status(400).json({
          error: "La ciudad es obligatoria",
        });
      }

      if (!MUNICIPIOS.includes(ciudad)) {
        return res.status(400).json({
          error: "El municipio seleccionado no está habilitado",
        });
      }

      if (!direccion || !direccion.trim()) {
        return res.status(400).json({
          error: "La dirección es obligatoria",
        });
      }

      if (!tipoReporte) {
        return res.status(400).json({
          error: "El tipo de reporte es obligatorio",
        });
      }

      if (!TIPOS_REPORTE.includes(tipoReporte)) {
        return res.status(400).json({
          error: "Tipo de reporte inválido",
        });
      }

      if (
        !telefonoWhatsapp ||
        !telefonoWhatsapp.trim()
      ) {
        return res.status(400).json({
          error: "El teléfono es obligatorio",
        });
      }

      if (!descripcion || !descripcion.trim()) {
        return res.status(400).json({
          error: "La descripción es obligatoria",
        });
      }


      // =================================================
      // FOTO
      // =================================================

      if (
        tipoReporte === "Persona no localizada" &&
        !req.file
      ) {
        return res.status(400).json({
          error:
            "Debes adjuntar una fotografía de la persona no localizada",
        });
      }


      // Nadie puede subir fotografías para otro tipo
      // de reporte.

      if (
        tipoReporte !== "Persona no localizada" &&
        req.file
      ) {
        return res.status(400).json({
          error:
            "La fotografía solamente está permitida para personas no localizadas",
        });
      }


      // =================================================
      // NECESIDADES
      // =================================================

      let necesidadesArray = [];

      if (necesidades) {
        try {
          necesidadesArray =
            typeof necesidades === "string"
              ? JSON.parse(necesidades)
              : necesidades;

          if (!Array.isArray(necesidadesArray)) {
            necesidadesArray = [];
          }
        } catch (error) {
          necesidadesArray = [];
        }
      }


      // =================================================
      // CREAR REPORTE
      // =================================================

      const nuevoReporte = new Emergencia({
        nombre: nombre.trim(),

        ciudad,

        direccion: direccion.trim(),

        tipoReporte,

        telefonoWhatsapp:
          telefonoWhatsapp.replace(/\D/g, ""),

        estadoVivienda:
          estadoVivienda || "",

        personasAfectadas:
          Number(personasAfectadas) || 1,

        necesidades:
          necesidadesArray,

        descripcion:
          descripcion.trim(),

        latitud:
          latitud ? Number(latitud) : null,

        longitud:
          longitud ? Number(longitud) : null,
      });


      const reporteGuardado =
        await nuevoReporte.save();


      // =================================================
      // SUBIR FOTO
      // =================================================

      if (
        tipoReporte === "Persona no localizada" &&
        req.file
      ) {
        try {
          const resultado =
            await subirFotoEmergencia(
              req.file.buffer,
              reporteGuardado._id.toString()
            );


          reporteGuardado.foto = {
            url: resultado.secure_url,
            public_id: resultado.public_id,
          };


          await reporteGuardado.save();


          console.log(
            "📸 Foto guardada en Cloudinary:",
            reporteGuardado._id.toString()
          );

        } catch (error) {

          console.error(
            "❌ Error subiendo fotografía:",
            error
          );

          // Eliminamos el reporte porque si se trata
          // de una persona no localizada necesitamos
          // conservar el registro completo.

          await Emergencia.findByIdAndDelete(
            reporteGuardado._id
          );

          return res.status(500).json({
            error:
              "No fue posible guardar la fotografía. El reporte no fue creado.",
          });
        }
      }


      // =================================================
      // RESPUESTA
      // =================================================

      console.log(
        "================================="
      );

      console.log(
        "🚨 NUEVO REPORTE"
      );

      console.log(
        "ID:",
        reporteGuardado._id.toString()
      );

      console.log(
        "Ciudad:",
        reporteGuardado.ciudad
      );

      console.log(
        "Tipo:",
        reporteGuardado.tipoReporte
      );

      console.log(
        "================================="
      );


      res.status(201).json({
        ok: true,

        mensaje:
          "Reporte registrado correctamente",

        reporte: {
          id: reporteGuardado._id,

          ciudad:
            reporteGuardado.ciudad,

          tipoReporte:
            reporteGuardado.tipoReporte,

          fecha:
            reporteGuardado.fechaCreacion,
        },
      });

    } catch (error) {

      console.error(
        "❌ ERROR CREANDO REPORTE:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Error interno del servidor",
      });
    }
  }
);


// =====================================================
// CONSULTAR REPORTES
// =====================================================
//
// Esta ruta nos servirá posteriormente para el
// panel de autoridades y el mapa.
//

app.get(
  "/api/emergencias",
  async (req, res) => {
    try {

      const filtro = {
        activa: true,
      };


      if (req.query.ciudad) {
        filtro.ciudad =
          req.query.ciudad;
      }


      if (req.query.tipoReporte) {
        filtro.tipoReporte =
          req.query.tipoReporte;
      }


      const reportes =
        await Emergencia
          .find(filtro)
          .sort({
            fechaCreacion: -1,
          });


      res.json({
        ok: true,

        total: reportes.length,

        reportes,
      });

    } catch (error) {

      console.error(
        "❌ ERROR CONSULTANDO REPORTES:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Error consultando los reportes",
      });
    }
  }
);


// =====================================================
// OBTENER UN REPORTE
// =====================================================

app.get(
  "/api/emergencias/:id",
  async (req, res) => {

    try {

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          error: "ID inválido",
        });
      }


      const reporte =
        await Emergencia.findById(
          req.params.id
        );


      if (!reporte) {
        return res.status(404).json({
          error:
            "Reporte no encontrado",
        });
      }


      res.json({
        ok: true,
        reporte,
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        error:
          "Error obteniendo reporte",
      });
    }
  }
);


// =====================================================
// ESTADÍSTICAS
// =====================================================
//
// Esta ruta es la base del futuro dashboard.
//

app.get(
  "/api/emergencias/estadisticas/resumen",
  async (req, res) => {

    try {

      const [
        total,
        porCiudad,
        porTipo,
        personas,
      ] = await Promise.all([

        Emergencia.countDocuments({
          activa: true,
        }),

        Emergencia.aggregate([
          {
            $match: {
              activa: true,
            },
          },

          {
            $group: {
              _id: "$ciudad",
              cantidad: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              cantidad: -1,
            },
          },
        ]),

        Emergencia.aggregate([
          {
            $match: {
              activa: true,
            },
          },

          {
            $group: {
              _id: "$tipoReporte",
              cantidad: {
                $sum: 1,
              },
            },
          },

          {
            $sort: {
              cantidad: -1,
            },
          },
        ]),

        Emergencia.aggregate([
          {
            $match: {
              activa: true,
            },
          },

          {
            $group: {
              _id: null,

              personas: {
                $sum: "$personasAfectadas",
              },
            },
          },
        ]),
      ]);


      res.json({
        ok: true,

        totalReportes: total,

        personasAfectadas:
          personas.length > 0
            ? personas[0].personas
            : 0,

        porCiudad,

        porTipo,
      });

    } catch (error) {

      console.error(
        "❌ ERROR ESTADÍSTICAS:",
        error
      );

      res.status(500).json({
        error:
          "Error obteniendo estadísticas",
      });
    }
  }
);


// =====================================================
// 404
// =====================================================

app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
  });
});


// =====================================================
// ERRORES MULTER
// =====================================================

app.use(
  (error, req, res, next) => {

    if (
      error instanceof multer.MulterError
    ) {

      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res.status(400).json({
          error:
            "La fotografía no puede superar los 5 MB",
        });
      }

      if (
        error.code ===
        "LIMIT_FILE_COUNT"
      ) {
        return res.status(400).json({
          error:
            "Solo se permite una fotografía",
        });
      }

      return res.status(400).json({
        error:
          "Error procesando la fotografía",
      });
    }


    if (error) {

      console.error(
        "❌ ERROR:",
        error
      );

      return res.status(400).json({
        error:
          error.message ||
          "Error procesando la solicitud",
      });
    }


    next();
  }
);


// =====================================================
// INICIAR SERVIDOR
// =====================================================

app.listen(PORT, () => {

  console.log("");
  console.log(
    "🇨🇴 ================================="
  );

  console.log(
    "🇨🇴 SISTEMA DE AYUDA CIUDADANA"
  );

  console.log(
    "🇨🇴 ================================="
  );

  console.log(
    `🚀 Puerto: ${PORT}`
  );

  console.log(
    `❤️ Health: /health`
  );

  console.log(
    `🚨 Reportes: /api/emergencias`
  );

  console.log(
    `📊 Estadísticas: /api/emergencias/estadisticas/resumen`
  );

  console.log("");
});
