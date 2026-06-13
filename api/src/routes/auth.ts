import { Router } from "express";
import { Prisma, ShiftAssignmentStatus, ShiftStatus, UserRole } from "@prisma/client";

import { signAccessToken } from "../lib/auth";
import { hashPassword, verifyPassword } from "../lib/password";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { sendBadRequest } from "../lib/http";

export const authRouter = Router();

const selfRegistrationRoles = [UserRole.CLIENT, UserRole.WORKER] as const;

function publicUser(user: {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
}) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    isActive: user.isActive
  };
}

authRouter.post("/login", async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || typeof phone !== "string") {
    return res.status(400).json({
      error: "phone is required"
    });
  }

  if (!password || typeof password !== "string") {
    return res.status(400).json({
      error: "password is required"
    });
  }

  const user = await prisma.user.findUnique({
    where: {
      phone: phone.trim()
    }
  });

  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({
      error: "Invalid phone or password"
    });
  }

  const token = signAccessToken({
    userId: user.id,
    role: user.role
  });

  return res.status(200).json({
    token,
    user: publicUser(user)
  });
});

authRouter.post("/register", async (req, res) => {
  const { firstName, lastName, phone, email, password, role } = req.body;

  if (!firstName || typeof firstName !== "string") {
    return sendBadRequest(res, "firstName is required");
  }

  if (!phone || typeof phone !== "string") {
    return sendBadRequest(res, "phone is required");
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    return sendBadRequest(res, "password must be at least 6 characters long");
  }

  const requestedRole = role && selfRegistrationRoles.includes(role) ? role : UserRole.CLIENT;
  const normalizedPhone = phone.trim();
  const normalizedEmail =
    typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;

  const existingUser = await prisma.user.findFirst({
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

  if (existingUser?.phone === normalizedPhone) {
    return res.status(409).json({
      error: "Пользователь с таким телефоном уже существует"
    });
  }

  if (normalizedEmail && existingUser?.email === normalizedEmail) {
    return res.status(409).json({
      error: "Пользователь с таким email уже существует"
    });
  }

  let user;

  try {
    user = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: typeof lastName === "string" ? lastName.trim() || null : null,
        phone: normalizedPhone,
        email: normalizedEmail,
        role: requestedRole,
        passwordHash: hashPassword(password)
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({
        error: "Пользователь с таким телефоном или email уже существует"
      });
    }

    throw error;
  }

  const token = signAccessToken({
    userId: user.id,
    role: user.role
  });

  return res.status(201).json({
    token,
    user: publicUser(user)
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: {
      id: req.auth!.userId
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      role: true,
      isActive: true,
      clientRequests: {
        select: {
          id: true,
          title: true,
          address: true,
          status: true,
          priority: true,
          createdAt: true,
          desiredStartDate: true,
          desiredEndDate: true
        },
        orderBy: {
          createdAt: "desc"
        }
      },
      clientProjects: {
        select: {
          id: true,
          title: true,
          address: true,
          status: true,
          workStage: true,
          workflowStatus: true,
          plannedStartDate: true,
          plannedEndDate: true,
          clientNotice: true,
          clientNotifiedAt: true,
          startDate: true,
          endDate: true,
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true
            }
          },
          _count: {
            select: {
              shifts: true,
              resources: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      },
      managedProjects: {
        select: {
          id: true,
          title: true,
          status: true,
          address: true,
          workStage: true,
          workflowStatus: true,
          plannedStartDate: true,
          plannedEndDate: true,
          teamReadyAt: true,
          resourcesReadyAt: true,
          planSubmittedAt: true,
          plannedWorkers: true,
          _count: {
            select: {
              shifts: true,
              resources: true
            }
          }
        }
      },
      createdShifts: {
        select: {
          id: true,
          title: true,
          status: true,
          startsAt: true,
          project: {
            select: {
              title: true
            }
          }
        },
        orderBy: {
          startsAt: "asc"
        }
      },
      assignments: {
        where: {
          status: {
            notIn: [ShiftAssignmentStatus.CANCELLED, ShiftAssignmentStatus.REJECTED]
          },
          shift: {
            status: {
              not: ShiftStatus.CANCELLED
            }
          }
        },
        select: {
          id: true,
          status: true,
          appliedAt: true,
          confirmedAt: true,
          shift: {
            select: {
              id: true,
              title: true,
              startsAt: true,
              endsAt: true,
              status: true,
              hourlyRate: true,
              payMultiplier: true,
              shiftHours: true,
              estimatedShiftCount: true,
              kind: true,
              workSchedule: true,
              isWeekend: true,
              isHoliday: true,
              project: {
                select: {
                  id: true,
                  title: true,
                  address: true
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

  return res.status(200).json(user);
});
