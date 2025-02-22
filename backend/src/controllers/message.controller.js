import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from "../models/users.models.js";
import { Message } from "../models/messages.models.js";
import { getReceiverSocketId } from "../server.js";

const getUserList = asyncHandler(async (req, res, next) => {
  const loggedInUser = req.user?._id;

  if (!loggedInUser) return next(new ApiError(400, "User not logged In"));

  const remainingUsers = await User.find({
    _id: { $ne: loggedInUser },
  }).select("-password -refreshToken");

  if (!remainingUsers) return next(new ApiError(400, "Unable to Fetch Users"));

  return res
    .status(200)
    .json(
      new ApiResponse(200, remainingUsers, "User List Fetched Successfully!!")
    );
});

const getMessages = asyncHandler(async (req, res, next) => {
  const { id: userToChat } = req.params;
  const loggedInUserId = req.user?._id;

  if (!(userToChat || loggedInUserId))
    return next(new ApiError(400, "User doesn't exist"));

  const messageList = await Message.find({
    $or: [
      { senderId: loggedInUserId, recieverId: userToChat },
      { senderId: userToChat, recieverId: loggedInUserId },
    ],
  });

  if (!messageList) return next(new ApiError(400, "Unable to Fetch Messages"));

  return res
    .status(200)
    .json(new ApiResponse(200, messageList, "User Fetched Successfully!!"));
});

const sendMessage = asyncHandler(async (req, res, next) => {
  const { content } = req.body;
  const localMediaPath = req.file?.path;
  const { id: recieverId } = req.params;
  const senderId = req.user?._id;

  if (!(content || localMediaPath))
    return next(new ApiError(400, "Message Empty"));

  let media;
  if (localMediaPath) {
    media = await uploadOnCloudinary(localMediaPath);
  }

  const message = await Message.create({
    senderId,
    recieverId,
    content,
    media: media?.url || null,
  });

  if (!message) return next(new ApiError(400, "Unable to create Message"));

  const recieverSocketId = getReceiverSocketId(recieverId);
  if (recieverSocketId) {
    io.to(recieverSocketId).emit("newMessage", message);
  }

  return res
    .status(201)
    .json(new ApiResponse(201, message, "Message Sent Successfully!!"));
});

const deleteMessage = asyncHandler(async (req, res, next) => {
  const { messageId } = req.params;

  if (!messageId) return next(new ApiError(400, "No Message Selected"));

  await Message.findByIdAndDelete(messageId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Message Deleted Successfully!!"));
});

export { getUserList, getMessages, sendMessage, deleteMessage };
