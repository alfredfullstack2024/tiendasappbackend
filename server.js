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
// CONFIGURACIÓN CLOUDINARY
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

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

// =====================================================
// MULTER
// =====================================================
// Solo una fotografía.
// Máximo 5 MB.
// La fotografía únicamente se permite para
// "Persona no localizada".

const storage = multer.memoryStorage();

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(
        new Error("Solo se permiten imágenes")
      );
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
    console.error(
      "❌ ERROR MONGODB:",
      error
    );
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
    // -------------------------------------------------
    // DATOS PERSONA
    // -------------------------------------------------

    nombre: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    // -------------------------------------------------
    // UBICACIÓN
    // -------------------------------------------------

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

    latitud: {
      type: Number,
      default: null,
    },

    longitud: {
      type: Number,
      default: null,
    },

    // -------------------------------------------------
    // TIPO REPORTE
    // -------------------------------------------------

    tipoReporte: {
      type: String,
      required: true,
      enum: TIPOS_REPORTE,
    },

    // -------------------------------------------------
    // CONTACTO
    // -------------------------------------------------

    telefonoWhatsapp: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },

    // -------------------------------------------------
    // ESTADO VIVIENDA
    // -------------------------------------------------

    estadoVivienda: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },

    // -------------------------------------------------
    // PERSONAS AFECTADAS
    // -------------------------------------------------

    personasAfectadas: {
      type: Number,
      default: 1,
      min: 1,
      max: 1000,
    },

    // -------------------------------------------------
    // NECESIDADES
    // -------------------------------------------------

    necesidades: {
      type: [String],
      default: [],
    },

    // -------------------------------------------------
    // DESCRIPCIÓN
    // -------------------------------------------------

    descripcion: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    // -------------------------------------------------
    // FOTO
    // SOLO PARA PERSONA NO LOCALIZADA
    // -------------------------------------------------

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

    // -------------------------------------------------
    // ESTADO DEL REPORTE
    // -------------------------------------------------

    activa: {
      type: Boolean,
      default: true,
    },

    // -------------------------------------------------
    // PERSONA ENCONTRADA
    // -------------------------------------------------

    encontrada: {
      type: Boolean,
      default: false,
    },

    fechaEncontrada: {
      type: Date,
      default: null,
    },

    // -------------------------------------------------
    // FECHAS
    // -------------------------------------------------

    fechaCreacion: {
      type: Date,
      default: Date.now,
    },
  },

  {
    timestamps: true,
  }
);

// =====================================================
// ÍNDICES
// =====================================================

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

emergenciaSchema.index({
  encontrada: 1,
});

// =====================================================
// MODELO
// =====================================================

const Emergencia = mongoose.model(
  "Emergencia",
  emergenciaSchema
);

// =====================================================
// SUBIR FOTO A CLOUDINARY
// =====================================================

const subirFotoEmergencia = async (
  buffer,
  reporteId
) => {
  return new Promise(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
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
    }
  );
};

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    servicio:
      "Sistema de Ayuda Ciudadana",
    fecha:
      new Date().toISOString(),
  });
});

// =====================================================
// MUNICIPIOS
// =====================================================

app.get(
  "/api/municipios",
  (req, res) => {
    res.json(MUNICIPIOS);
  }
);

// =====================================================
// TIPOS DE REPORTE
// =====================================================

app.get(
  "/api/tipos-reporte",
  (req, res) => {
    res.json(TIPOS_REPORTE);
  }
);

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

      if (
        !nombre ||
        !nombre.trim()
      ) {
        return res.status(400).json({
          error:
            "El nombre es obligatorio",
        });
      }

      if (!ciudad) {
        return res.status(400).json({
          error:
            "La ciudad es obligatoria",
        });
      }

      if (
        !MUNICIPIOS.includes(
          ciudad
        )
      ) {
        return res.status(400).json({
          error:
            "El municipio seleccionado no está habilitado",
        });
      }

      if (
        !direccion ||
        !direccion.trim()
      ) {
        return res.status(400).json({
          error:
            "La dirección es obligatoria",
        });
      }

      if (!tipoReporte) {
        return res.status(400).json({
          error:
            "El tipo de reporte es obligatorio",
        });
      }

      if (
        !TIPOS_REPORTE.includes(
          tipoReporte
        )
      ) {
        return res.status(400).json({
          error:
            "Tipo de reporte inválido",
        });
      }

      if (
        !telefonoWhatsapp ||
        !telefonoWhatsapp.trim()
      ) {
        return res.status(400).json({
          error:
            "El teléfono es obligatorio",
        });
      }

      if (
        !descripcion ||
        !descripcion.trim()
      ) {
        return res.status(400).json({
          error:
            "La descripción es obligatoria",
        });
      }

      // =================================================
      // FOTO
      // =================================================

      if (
        tipoReporte ===
          "Persona no localizada" &&
        !req.file
      ) {
        return res.status(400).json({
          error:
            "Debes adjuntar una fotografía de la persona no localizada",
        });
      }

      if (
        tipoReporte !==
          "Persona no localizada" &&
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
            typeof necesidades ===
            "string"
              ? JSON.parse(
                  necesidades
                )
              : necesidades;

          if (
            !Array.isArray(
              necesidadesArray
            )
          ) {
            necesidadesArray = [];
          }

        } catch (error) {

          necesidadesArray = [];
        }
      }

      // =================================================
      // CREAR REPORTE
      // =================================================

      const nuevoReporte =
        new Emergencia({

          nombre:
            nombre.trim(),

          ciudad,

          direccion:
            direccion.trim(),

          tipoReporte,

          telefonoWhatsapp:
            telefonoWhatsapp.replace(
              /\D/g,
              ""
            ),

          estadoVivienda:
            estadoVivienda || "",

          personasAfectadas:
            Number(
              personasAfectadas
            ) || 1,

          necesidades:
            necesidadesArray,

          descripcion:
            descripcion.trim(),

          latitud:
            latitud
              ? Number(latitud)
              : null,

          longitud:
            longitud
              ? Number(longitud)
              : null,

          encontrada: false,

          activa: true,
        });

      const reporteGuardado =
        await nuevoReporte.save();

      // =================================================
      // SUBIR FOTO
      // =================================================

      if (
        tipoReporte ===
          "Persona no localizada" &&
        req.file
      ) {

        try {

          const resultado =
            await subirFotoEmergencia(
              req.file.buffer,
              reporteGuardado._id.toString()
            );

          reporteGuardado.foto = {
            url:
              resultado.secure_url,

            public_id:
              resultado.public_id,
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
      // LOG
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
        "Nombre:",
        reporteGuardado.nombre
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

      // =================================================
      // RESPUESTA
      // =================================================

      return res.status(201).json({

        ok: true,

        mensaje:
          "Reporte registrado correctamente",

        reporte: {
          id:
            reporteGuardado._id,

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

      return res.status(500).json({
        ok: false,
        error:
          "Error interno del servidor",
      });
    }
  }
);

// =====================================================
// CONSULTAR REPORTES PÚBLICOS
// =====================================================
//
// IMPORTANTE:
// Esta ruta NO devuelve dirección ni teléfono.
//
// Para personas no localizadas devuelve solamente
// información necesaria para ayudar.
//
// Los registros encontrados no aparecen.
// =====================================================

app.get(
  "/api/emergencias",
  async (req, res) => {

    try {

      const filtro = {
        activa: true,

        // $ne permite que también funcionen
        // registros antiguos que todavía no
        // tenían el campo "encontrada".
        encontrada: {
          $ne: true,
        },
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
          .select(
            "_id nombre ciudad tipoReporte descripcion foto fechaCreacion estadoVivienda personasAfectadas necesidades"
          )
          .sort({
            fechaCreacion: -1,
          });

      return res.json({

        ok: true,

        total:
          reportes.length,

        reportes,
      });

    } catch (error) {

      console.error(
        "❌ ERROR CONSULTANDO REPORTES:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Error consultando los reportes",
      });
    }
  }
);

// =====================================================
// MARCAR PERSONA COMO ENCONTRADA
// =====================================================
//
// IMPORTANTE:
// No borramos el registro.
//
// Solamente cambiamos:
// encontrada = true
//
// De esta forma desaparece de la página pública,
// pero conservamos la información para estadísticas.
// =====================================================

app.patch(
  "/api/emergencias/:id/encontrada",

  async (req, res) => {

    try {

      const { id } =
        req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {

        return res.status(400).json({
          ok: false,
          error:
            "ID inválido",
        });
      }

      const reporte =
        await Emergencia.findOne({
          _id: id,

          tipoReporte:
            "Persona no localizada",
        });

      if (!reporte) {

        return res.status(404).json({
          ok: false,
          error:
            "Persona no localizada no encontrada",
        });
      }

      if (
        reporte.encontrada === true
      ) {

        return res.status(400).json({
          ok: false,
          error:
            "Esta persona ya fue marcada como encontrada",
        });
      }

      reporte.encontrada = true;

      reporte.fechaEncontrada =
        new Date();

      await reporte.save();

      console.log(
        "================================="
      );

      console.log(
        "❤️ PERSONA ENCONTRADA"
      );

      console.log(
        "ID:",
        reporte._id.toString()
      );

      console.log(
        "Nombre:",
        reporte.nombre
      );

      console.log(
        "Ciudad:",
        reporte.ciudad
      );

      console.log(
        "Fecha:",
        reporte.fechaEncontrada
      );

      console.log(
        "================================="
      );

      return res.json({

        ok: true,

        mensaje:
          "La persona fue marcada como encontrada",

        reporte: {

          id:
            reporte._id,

          nombre:
            reporte.nombre,

          ciudad:
            reporte.ciudad,

          encontrada: true,

          fechaEncontrada:
            reporte.fechaEncontrada,
        },
      });

    } catch (error) {

      console.error(
        "❌ ERROR MARCANDO PERSONA COMO ENCONTRADA:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "No fue posible actualizar el reporte",
      });
    }
  }
);

// =====================================================
// ESTADÍSTICAS GENERALES
// =====================================================

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

        // ---------------------------------------------
        // TOTAL REPORTES
        // ---------------------------------------------

        Emergencia.countDocuments({
          activa: true,
        }),

        // ---------------------------------------------
        // REPORTES POR CIUDAD
        // ---------------------------------------------

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

        // ---------------------------------------------
        // REPORTES POR TIPO
        // ---------------------------------------------

        Emergencia.aggregate([

          {
            $match: {
              activa: true,
            },
          },

          {
            $group: {

              _id:
                "$tipoReporte",

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

        // ---------------------------------------------
        // PERSONAS AFECTADAS
        // ---------------------------------------------

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
                $sum:
                  "$personasAfectadas",
              },
            },
          },
        ]),
      ]);

      return res.json({

        ok: true,

        totalReportes:
          total,

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

      return res.status(500).json({
        ok: false,
        error:
          "Error obteniendo estadísticas",
      });
    }
  }
);

// =====================================================
// ESTADÍSTICAS PERSONAS NO LOCALIZADAS
// =====================================================

app.get(
  "/api/emergencias/estadisticas/desaparecidos",

  async (req, res) => {

    try {

      const [
        totalNoLocalizadas,
        totalEncontradas,
        porCiudad,
      ] = await Promise.all([

        // ---------------------------------------------
        // ACTUALMENTE NO LOCALIZADAS
        // ---------------------------------------------

        Emergencia.countDocuments({

          activa: true,

          tipoReporte:
            "Persona no localizada",

          encontrada: {
            $ne: true,
          },
        }),

        // ---------------------------------------------
        // ENCONTRADAS
        // ---------------------------------------------

        Emergencia.countDocuments({

          activa: true,

          tipoReporte:
            "Persona no localizada",

          encontrada: true,
        }),

        // ---------------------------------------------
        // NO LOCALIZADAS POR CIUDAD
        // ---------------------------------------------

        Emergencia.aggregate([

          {
            $match: {

              activa: true,

              tipoReporte:
                "Persona no localizada",

              encontrada: {
                $ne: true,
              },
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
      ]);

      return res.json({

        ok: true,

        personasNoLocalizadas:
          totalNoLocalizadas,

        personasEncontradas:
          totalEncontradas,

        porCiudad,
      });

    } catch (error) {

      console.error(
        "❌ ERROR ESTADÍSTICAS DESAPARECIDOS:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Error obteniendo estadísticas",
      });
    }
  }
);

// =====================================================
// OBTENER UN REPORTE POR ID
// =====================================================
//
// Esta ruta es interna para consultas específicas.
// NO usarla como endpoint público de la página de
// desaparecidos porque contiene datos privados.
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
          ok: false,
          error:
            "ID inválido",
        });
      }

      const reporte =
        await Emergencia.findById(
          req.params.id
        );

      if (!reporte) {

        return res.status(404).json({
          ok: false,
          error:
            "Reporte no encontrado",
        });
      }

      return res.json({

        ok: true,

        reporte,
      });

    } catch (error) {

      console.error(
        "❌ ERROR OBTENIENDO REPORTE:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Error obteniendo reporte",
      });
    }
  }
);

// =====================================================
// 404
// =====================================================

app.use(
  (req, res) => {

    res.status(404).json({
      ok: false,
      error:
        "Ruta no encontrada",
    });
  }
);

// =====================================================
// ERRORES MULTER / GENERALES
// =====================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {

    // -----------------------------------------------
    // ERROR MULTER
    // -----------------------------------------------

    if (
      error instanceof
      multer.MulterError
    ) {

      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {

        return res.status(400).json({
          ok: false,
          error:
            "La fotografía no puede superar los 5 MB",
        });
      }

      if (
        error.code ===
        "LIMIT_FILE_COUNT"
      ) {

        return res.status(400).json({
          ok: false,
          error:
            "Solo se permite una fotografía",
        });
      }

      return res.status(400).json({
        ok: false,
        error:
          "Error procesando la fotografía",
      });
    }

    // -----------------------------------------------
    // OTROS ERRORES
    // -----------------------------------------------

    if (error) {

      console.error(
        "❌ ERROR:",
        error
      );

      return res.status(400).json({
        ok: false,
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

app.listen(
  PORT,
  () => {

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
      "❤️ Health: /health"
    );

    console.log(
      "🚨 Reportes: /api/emergencias"
    );

    console.log(
      "📊 Estadísticas: /api/emergencias/estadisticas/resumen"
    );

    console.log(
      "🔎 Desaparecidos: /api/emergencias/estadisticas/desaparecidos"
    );

    console.log("");
  }
);
