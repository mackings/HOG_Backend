import ImageKit from "imagekit";

const getImageKitClient = () => {
  const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } = process.env;
  if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) {
    return null;
  }

  return new ImageKit({
    publicKey: IMAGEKIT_PUBLIC_KEY,
    privateKey: IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: IMAGEKIT_URL_ENDPOINT,
  });
};

export const getImageKitAuth = (req, res) => {
  const imageKit = getImageKitClient();
  if (!imageKit) {
    return res.status(500).json({ message: "ImageKit is not configured" });
  }

  const authParams = imageKit.getAuthenticationParameters();
  return res.status(200).json(authParams);
};
