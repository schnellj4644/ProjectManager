import User from "../models/user.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Verification from "../models/verification.js";
import { sendEmail } from "../libs/send-email.js";
import aj from "../libs/arcjet.js";

const registerUser = async (req, res) => {
  try {
    const { email, name, password } = req.body;

    const decision = await aj.protect(req, { email }); // Deduct 5 tokens from the bucket
    console.log("Arcjet decision", decision);

    if (decision.isDenied()) {
      if (decision.reason.isEmail) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid email address" }));
      }
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email address already in use" });
    }

    const salt = await bcrypt.genSalt(10);

    const hashPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      email,
      password: hashPassword,
      name,
    });

    const verificationToken = jwt.sign(
      { userId: newUser._id, purpose: "email-verification" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    await Verification.create({
      userId: newUser._id,
      token: verificationToken,
      expiresAt: new Date(Date.now() + 3600000),
    });

    // send email
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    const emailBodyText = `Click the following link to verify your email address: ${verificationLink}`;
    const emailBodyHTML = `<p>Click <a href=${verificationLink}>here</a> to verify your email address.</p>`;
    const emailSubject = "Verify your email address";

    const isEmailSent = sendEmail(
      newUser.email,
      emailSubject,
      emailBodyText,
      emailBodyHTML,
    );

    isEmailSent
      .then(() => {
        res.status(201).json({
          message:
            "Verification email sent to your email. Please check and verify your account.",
        });
      })
      .catch((err) => {
        res.status(500).json({
          message: "Failed to send verification email. Please try again later.",
        });
      });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Internal Server Error" });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (!user.isEmailVerified) {
      const existingVerification = await Verification.findOne({
        userId: user._id,
      });

      if (existingVerification && existingVerification.expiresAt > new Date()) {
        return res.status(400).json({
          message:
            "Email not verified. Please check your email for verification link.",
        });
      } else {
        await Verification.findByIdAndDelete(existingVerification?._id);

        const verificationToken = jwt.sign(
          { userId: user._id, purpose: ["email-verification"] },
          process.env.JWT_SECRET,
          { expiresIn: "1h" },
        );

        await Verification.create({
          userId: user._id,
          token: verificationToken,
          expiresAt: new Date(Date.now() + 3600000),
        });

        // send email
        const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
        const emailBodyText = `Click the following link to verify your email address: ${verificationLink}`;
        const emailBodyHTML = `<p>Click <a href=${verificationLink}>here</a> to verify your email address.</p>`;
        const emailSubject = "Verify your email address";

        const isEmailSent = sendEmail(
          newUser.email,
          emailSubject,
          emailBodyText,
          emailBodyHTML,
        );

        isEmailSent
          .then(() => {
            res.status(201).json({
              message:
                "Verification email sent to your email. Please check and verify your account.",
            });
          })
          .catch((err) => {
            res.status(500).json({
              message:
                "Failed to send verification email. Please try again later.",
            });
          });
      }
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user._id, purpose: ["login"] },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    user.lastLogin = new Date();
    await user.save();

    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({
      message: "Login successful",
      token,
      user: userData,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({ message: "Internal Server Error" });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!payload) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const { userId, purpose } = payload;

    if (purpose !== "email-verification") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const verification = await Verification.findOne({ userId, token });

    if (!verification) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const tokenExpired = verification.expiresAt < new Date();

    if (tokenExpired) {
      return res.status(401).json({ message: "Token has expired" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    user.isEmailVerified = true;
    await user.save();

    await Verification.findByIdAndDelete(verification._id);

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const resetPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found." });
    }

    if (!user.isEmailVerified) {
      return res
        .status(400)
        .json({ message: "Please verify your email first." });
    }

    const existingVerification = await Verification.findOne({
      userId: user._id,
    });

    if (existingVerification && existingVerification.expiresAt > new Date()) {
      return res.status(400).json({
        message: "Reset password request already sent.",
      });
    }

    if (existingVerification && existingVerification.expiresAt <= new Date()) {
      await Verification.findByIdAndDelete(existingVerification._id);
    }

    const resetPasswordToken = jwt.sign(
      { userId: user._id, purpose: "reset-password" },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    await Verification.create({
      userId: user._id,
      token: resetPasswordToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    // send email
    const resetPasswordLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetPasswordToken}`;
    const emailBodyText = `Click the following link to reset your password: ${resetPasswordLink}`;
    const emailBodyHTML = `<p>Click <a href=${resetPasswordLink}>here</a> to reset your password.</p>`;
    const emailSubject = "Reset Your Password";

    const isEmailSent = sendEmail(
      user.email,
      emailSubject,
      emailBodyText,
      emailBodyHTML,
    );

    isEmailSent
      .then(() => {
        res.status(200).json({
          message:
            "Reset password email sent to your email. Please check and follow the instructions.",
        });
      })
      .catch((err) => {
        res.status(500).json({
          message:
            "Failed to send reset password email. Please try again later.",
        });
      });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const verifyResetPasswordTokenAndResetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!payload) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const { userId, purpose } = payload;

    if (purpose !== "reset-password") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const verification = await Verification.findOne({ userId, token });

    if (!verification) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const tokenExpired = verification.expiresAt < new Date();

    if (tokenExpired) {
      return res.status(401).json({ message: "Token has expired" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (newPassword !== confirmPassword) {
      return res
        .status(400)
        .json({ message: "New Password and Confirm Password do not match" });
    }

    const salt = await bcrypt.genSalt(10);

    const hashPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashPassword;
    await user.save();

    await Verification.findByIdAndDelete(verification._id);

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export {
  registerUser,
  loginUser,
  verifyEmail,
  resetPasswordRequest,
  verifyResetPasswordTokenAndResetPassword,
};
