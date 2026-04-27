const bcrypt = require("bcrypt");
const User = require("../models/user.model");
const Profile = require("../models/profile.model");
const { signToken } = require("../config/auth");

const normalizeRole = (role) => {
  const value = String(role || "partner")
    .toLowerCase()
    .trim();
  if (value === "owner") return "owner";
  if (value === "admin") return "admin";
  return "partner";
};

const getRole = (user) => normalizeRole(user?.role);
const isOwnerUser = (user) => getRole(user) === "owner";
const getApprovalStatus = (user) => {
  if (isOwnerUser(user)) return "approved";
  return user?.approvalStatus || "approved";
};

const sanitizeUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  mobile: user.mobile,
  company: user.company,
  role: getRole(user),
  isActive: user.isActive !== false,
  approvalStatus: getApprovalStatus(user),
  createdAt: user.createdAt,
});

const isOwnerRequest = (req) =>
  String(req?.user?.role || "").toLowerCase() === "owner";

const denyIfNotOwner = (req, res) => {
  if (!isOwnerRequest(req)) {
    res.status(403).json({ message: "Only owner can manage users" });
    return true;
  }
  return false;
};

const register = async (req, res) => {
  try {
    const { fullName, mobile, password, company, email, role } = req.body;

    if (!fullName || !mobile || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existing = await User.findOne({ mobile });
    if (existing) {
      return res.status(409).json({ message: "Mobile already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const normalizedRole = normalizeRole(role);
    const approvalStatus = normalizedRole === "owner" ? "approved" : "pending";

    const user = await User.create({
      fullName,
      email,
      mobile,
      password: hashed,
      company,
      role: normalizedRole,
      approvalStatus,
    });

    if (approvalStatus !== "approved") {
      return res.status(202).json({
        message: "Signup request sent. Wait for owner approval before login.",
        user: sanitizeUser(user),
      });
    }

    const token = signToken({
      sub: user._id,
      mobile: user.mobile,
      role: getRole(user),
    });
    return res.status(201).json({ user: sanitizeUser(user), token });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const login = async (req, res) => {
  try {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({ message: "Missing mobile or password" });
    }

    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.isActive === false) {
      return res
        .status(403)
        .json({ message: "Account is inactive. Contact owner." });
    }

    const approvalStatus = getApprovalStatus(user);
    if (approvalStatus !== "approved") {
      return res
        .status(403)
        .json({ message: "Account pending approval from owner." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken({
      sub: user._id,
      mobile: user.mobile,
      role: getRole(user),
    });

    return res.json({
      user: sanitizeUser(user),
      token,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const approvalStatus = getApprovalStatus(user);
    if (approvalStatus !== "approved") {
      return res
        .status(403)
        .json({ message: "Account pending approval from owner." });
    }
    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("Profile error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const updateMe = async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    if (!fullName) {
      return res.status(400).json({ message: "Full name is required" });
    }

    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.fullName = fullName;
    await user.save();

    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("Update me error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const listUsers = async (req, res) => {
  try {
    if (denyIfNotOwner(req, res)) return;

    const users = await User.find({})
      .select(
        "fullName mobile email role isActive approvalStatus createdAt updatedAt",
      )
      .sort({ createdAt: -1 });

    return res.json({ users: users.map(sanitizeUser) });
  } catch (err) {
    console.error("List users error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    if (denyIfNotOwner(req, res)) return;

    const { userId } = req.params;
    const { isActive } = req.body || {};

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be boolean" });
    }

    if (String(req.user.sub) === String(userId) && !isActive) {
      return res
        .status(400)
        .json({ message: "Owner cannot deactivate own account" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (String(user.role || "").toLowerCase() === "owner") {
      return res
        .status(400)
        .json({ message: "Owner account status cannot be changed" });
    }

    user.isActive = isActive;
    await user.save();

    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("Update user status error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const updateUserApproval = async (req, res) => {
  try {
    if (denyIfNotOwner(req, res)) return;

    const { userId } = req.params;
    const { approvalStatus } = req.body || {};
    const validStatuses = ["pending", "approved", "rejected"];

    if (!validStatuses.includes(approvalStatus)) {
      return res
        .status(400)
        .json({
          message: "approvalStatus must be pending, approved, or rejected",
        });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (String(user.role || "").toLowerCase() === "owner") {
      return res
        .status(400)
        .json({ message: "Owner approval cannot be changed" });
    }

    user.approvalStatus = approvalStatus;
    if (approvalStatus === "rejected") {
      user.isActive = false;
    }
    await user.save();

    return res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("Update user approval error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    if (denyIfNotOwner(req, res)) return;

    const { userId } = req.params;
    const newPassword = String(req.body?.newPassword || "");

    if (newPassword.trim().length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (String(user.role || "").toLowerCase() === "owner") {
      return res
        .status(400)
        .json({ message: "Owner password cannot be reset from this panel" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    console.error("Reset user password error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const deleteUser = async (req, res) => {
  try {
    if (denyIfNotOwner(req, res)) return;

    const { userId } = req.params;
    if (String(req.user.sub) === String(userId)) {
      return res
        .status(400)
        .json({ message: "Owner cannot delete own account" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (String(user.role || "").toLowerCase() === "owner") {
      return res
        .status(400)
        .json({ message: "Owner account cannot be deleted" });
    }

    await Promise.all([
      User.findByIdAndDelete(userId),
      Profile.deleteOne({ user: userId }),
    ]);

    return res.json({ success: true, userId });
  } catch (err) {
    console.error("Delete user error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  register,
  login,
  me,
  updateMe,
  listUsers,
  updateUserStatus,
  updateUserApproval,
  resetUserPassword,
  deleteUser,
};
