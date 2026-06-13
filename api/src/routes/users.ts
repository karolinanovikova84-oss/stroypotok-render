import { Prisma, UserRole } from "@prisma/client";
import { Router } from "express";

import { sendBadRequest } from "../lib/http";
import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRoles } from "../middleware/auth";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/", requireRoles([UserRole.ADMIN, UserRole.COORDINATOR, UserRole.MANAGER]), async (req, res) => {
  const role = typeof req.query.role === "string" ? req.query.role : undefined;

  if (role && !Object.values(UserRole).includes(role as UserRole)) {
    return sendBadRequest(res, "invalid user role");
  }

  const users = await prisma.user.findMany({
    where: {
      role: role as UserRole | undefined
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          managedProjects: true,
          assignments: true,
          createdShifts: true
        }
      }
    }
  });

  res.status(200).json(users);
});

usersRouter.get("/:id", async (req, res) => {
  if (req.auth!.role !== UserRole.ADMIN && req.auth!.role !== UserRole.COORDINATOR && req.auth!.userId !== req.params.id) {
    return res.status(403).json({
      error: "Access denied"
    });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: req.params.id
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      managedProjects: {
        select: {
          id: true,
          title: true,
          status: true
        }
      },
      createdShifts: {
        select: {
          id: true,
          title: true,
          status: true,
          startsAt: true
        },
        orderBy: {
          startsAt: "desc"
        }
      },
      assignments: {
        select: {
          id: true,
          status: true,
          appliedAt: true,
          shift: {
            select: {
              id: true,
              title: true,
              startsAt: true,
              project: {
                select: {
                  title: true
                }
              }
            }
          }
        },
        orderBy: {
          appliedAt: "desc"
        }
      }
    }
  });

  if (!user) {
    return res.status(404).json({
      error: "User not found"
    });
  }

  res.status(200).json(user);
});

usersRouter.post("/", requireRoles([UserRole.ADMIN]), async (req, res) => {
  const {
    firstName,
    lastName,
    phone,
    email,
    role,
    password,
    isActive
  } = req.body;

  if (!firstName || typeof firstName !== "string") {
    return sendBadRequest(res, "firstName is required");
  }

  if (!phone || typeof phone !== "string") {
    return sendBadRequest(res, "phone is required");
  }

  if (!role || !Object.values(UserRole).includes(role)) {
    return sendBadRequest(res, "valid role is required");
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    return sendBadRequest(res, "password must be at least 6 characters long");
  }

  if (email && typeof email !== "string") {
    return sendBadRequest(res, "email must be a string");
  }

  const normalizedPhone = phone.trim();
  const normalizedEmail =
    typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;

  const duplicateUser = await prisma.user.findFirst({
    where: {
      OR: [
        {
          phone: normalizedPhone
        },
        ...(normalizedEmail
          ? [
              {
                email: normalizedEmail
              }
            ]
          : [])
      ]
    }
  });

  if (duplicateUser?.phone === normalizedPhone) {
    return res.status(409).json({
      error: "Пользователь с таким телефоном уже существует"
    });
  }

  if (normalizedEmail && duplicateUser?.email === normalizedEmail) {
    return res.status(409).json({
      error: "Пользователь с таким email уже существует"
    });
  }

  try {
    const user = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: typeof lastName === "string" ? lastName.trim() || null : null,
        phone: normalizedPhone,
        email: normalizedEmail,
        role,
        isActive: typeof isActive === "boolean" ? isActive : true,
        passwordHash: hashPassword(password)
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return res.status(201).json(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({
        error: "Пользователь с таким телефоном или email уже существует"
      });
    }

    throw error;
  }
});

usersRouter.patch("/:id", requireRoles([UserRole.ADMIN]), async (req, res) => {
  const userId = String(req.params.id);
  const { firstName, lastName, phone, email, role, password, isActive } = req.body;

  if (role && !Object.values(UserRole).includes(role)) {
    return sendBadRequest(res, "invalid role");
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId
    }
  });

  if (!existingUser) {
    return res.status(404).json({
      error: "User not found"
    });
  }

  const normalizedPhone = typeof phone === "string" ? phone.trim() : undefined;
  const normalizedEmail =
    typeof email === "string" && email.trim() ? email.trim().toLowerCase() : undefined;

  if (normalizedPhone || normalizedEmail) {
    const duplicateUser = await prisma.user.findFirst({
      where: {
        id: {
          not: existingUser.id
        },
        OR: [
          ...(normalizedPhone
            ? [
                {
                  phone: normalizedPhone
                }
              ]
            : []),
          ...(normalizedEmail
            ? [
                {
                  email: normalizedEmail
                }
              ]
            : [])
        ]
      }
    });

    if (duplicateUser?.phone === normalizedPhone) {
      return res.status(409).json({
        error: "Пользователь с таким телефоном уже существует"
      });
    }

    if (normalizedEmail && duplicateUser?.email === normalizedEmail) {
      return res.status(409).json({
        error: "Пользователь с таким email уже существует"
      });
    }
  }

  try {
    const user = await prisma.user.update({
      where: {
        id: existingUser.id
      },
      data: {
        firstName: typeof firstName === "string" ? firstName.trim() : undefined,
        lastName: typeof lastName === "string" ? lastName.trim() || null : undefined,
        phone: normalizedPhone,
        email: typeof email === "string" ? normalizedEmail || null : undefined,
        role: role || undefined,
        isActive: typeof isActive === "boolean" ? isActive : undefined,
        passwordHash:
          typeof password === "string" && password.length >= 6 ? hashPassword(password) : undefined
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return res.status(200).json(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({
        error: "Пользователь с таким телефоном или email уже существует"
      });
    }

    throw error;
  }
});
