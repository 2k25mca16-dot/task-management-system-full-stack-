import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const DEFAULT_ADMIN_EMAIL = "admin@gmail.com";
const DEFAULT_ADMIN_PASS = "admin@123";

function getRoleTable(role: string): string {
  const normalized = (role || "").trim().toLowerCase();
  if (normalized === "admin") return "admins";
  if (normalized === "manager") return "managers";
  if (normalized === "team") return "team_members";
  return "individual_users";
}

// Ensure the default admin exists and has role 'admin' with credentials admin@gmail.com / admin@123
async function ensureDefaultAdmin() {
  try {
    const existing: any = await query(
      "SELECT id, role, password FROM signup_users WHERE LOWER(email) = ?",
      [DEFAULT_ADMIN_EMAIL]
    );

    if (!existing || existing.length === 0) {
      await query(
        "INSERT INTO signup_users (name, role, email, password) VALUES (?, ?, ?, ?)",
        ["Admin", "admin", DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASS]
      );
      await query("DELETE FROM admins WHERE LOWER(email) = ?", [DEFAULT_ADMIN_EMAIL]);
      await query(
        "INSERT INTO admins (name, email, password) VALUES (?, ?, ?)",
        ["Admin", DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASS]
      );
    } else {
      const current = existing[0];
      if (current.role !== "admin" || current.password !== DEFAULT_ADMIN_PASS) {
        await query(
          "UPDATE signup_users SET role = 'admin', password = ? WHERE LOWER(email) = ?",
          [DEFAULT_ADMIN_PASS, DEFAULT_ADMIN_EMAIL]
        );
        await query("DELETE FROM admins WHERE LOWER(email) = ?", [DEFAULT_ADMIN_EMAIL]);
        await query(
          "INSERT INTO admins (name, email, password) VALUES (?, ?, ?)",
          ["Admin", DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASS]
        );
      }
    }
  } catch (err) {
    console.error("Error ensuring default admin:", err);
  }
}

// GET /api/users
export async function GET() {
  try {
    await ensureDefaultAdmin();
    const users = await query(
      "SELECT id, name, role, email, password FROM signup_users ORDER BY id ASC"
    );
    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users from MySQL:", error);
    return NextResponse.json([], { status: 500 });
  }
}

// POST /api/users (Signup / Create user)
export async function POST(req: Request) {
  try {
    await ensureDefaultAdmin();
    const body = await req.json();
    const { name, role, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // Prevent signing up as the admin email
    if (cleanEmail === DEFAULT_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "This email is reserved for the system administrator" },
        { status: 400 }
      );
    }

    // Role cannot be admin on signup. Default to 'user'
    let cleanRole = (role || "user").trim().toLowerCase();
    if (cleanRole === "admin") {
      cleanRole = "user";
    }

    // Check if user already exists
    const existing: any = await query(
      "SELECT id FROM signup_users WHERE LOWER(email) = ?",
      [cleanEmail]
    );

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // 1. Insert into general signup_users table
    const result: any = await query(
      "INSERT INTO signup_users (name, role, email, password) VALUES (?, ?, ?, ?)",
      [cleanName, cleanRole, cleanEmail, password]
    );

    // 2. Insert into the separate specific role table
    const roleTable = getRoleTable(cleanRole);
    await query(
      `INSERT INTO ${roleTable} (name, email, password) VALUES (?, ?, ?)`,
      [cleanName, cleanEmail, password]
    );

    return NextResponse.json(
      {
        message: "User added successfully",
        id: result.insertId,
        table: roleTable,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding user to MySQL:", error);
    return NextResponse.json(
      { error: "Failed to create user in database" },
      { status: 500 }
    );
  }
}

// PUT /api/users (Update role)
export async function PUT(req: Request) {
  try {
    await ensureDefaultAdmin();
    const { email, role } = await req.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanRole = role.trim().toLowerCase();

    // PROTECT DEFAULT ADMIN: Role cannot be changed by anybody!
    if (cleanEmail === DEFAULT_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "The default master admin role cannot be changed by anyone." },
        { status: 403 }
      );
    }

    // PROTECT ADMIN ROLE: No other user can be made admin!
    if (cleanRole === "admin") {
      return NextResponse.json(
        { error: "Only one default admin is permitted." },
        { status: 403 }
      );
    }

    const existing: any = await query(
      "SELECT * FROM signup_users WHERE LOWER(email) = ?",
      [cleanEmail]
    );

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = existing[0];

    // 1. Update in signup_users
    await query("UPDATE signup_users SET role = ? WHERE LOWER(email) = ?", [
      cleanRole,
      cleanEmail,
    ]);

    // 2. Remove from all role tables
    await query("DELETE FROM admins WHERE LOWER(email) = ?", [cleanEmail]);
    await query("DELETE FROM managers WHERE LOWER(email) = ?", [cleanEmail]);
    await query("DELETE FROM team_members WHERE LOWER(email) = ?", [cleanEmail]);
    await query("DELETE FROM individual_users WHERE LOWER(email) = ?", [cleanEmail]);

    // 3. Insert into the newly assigned role table
    const newRoleTable = getRoleTable(cleanRole);
    await query(
      `INSERT INTO ${newRoleTable} (name, email, password) VALUES (?, ?, ?)`,
      [user.name, cleanEmail, user.password]
    );

    return NextResponse.json({ message: "User role updated" });
  } catch (error) {
    console.error("Error updating user role in MySQL:", error);
    return NextResponse.json(
      { error: "Failed to update user role" },
      { status: 500 }
    );
  }
}

// DELETE /api/users
export async function DELETE(req: Request) {
  try {
    await ensureDefaultAdmin();
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required to delete a user" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // PROTECT DEFAULT ADMIN: Cannot be deleted!
    if (cleanEmail === DEFAULT_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "The default master admin account cannot be deleted." },
        { status: 403 }
      );
    }

    await query("DELETE FROM signup_users WHERE LOWER(email) = ?", [cleanEmail]);
    await query("DELETE FROM admins WHERE LOWER(email) = ?", [cleanEmail]);
    await query("DELETE FROM managers WHERE LOWER(email) = ?", [cleanEmail]);
    await query("DELETE FROM team_members WHERE LOWER(email) = ?", [cleanEmail]);
    await query("DELETE FROM individual_users WHERE LOWER(email) = ?", [cleanEmail]);

    return NextResponse.json({ message: "User deleted" });
  } catch (error) {
    console.error("Error deleting user from MySQL:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
