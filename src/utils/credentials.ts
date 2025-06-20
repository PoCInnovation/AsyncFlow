import { AWS_ACCESS_KEY, AWS_SECRET_KEY } from "./constants";

export function isEnvironmentValid() {
  if (AWS_SECRET_KEY === undefined || AWS_ACCESS_KEY === undefined) {
    console.error(
      "[ASYNCFLOW]: No aws secret or access key provided, please check relevent documentation.",
    );
    return false;
  }
  return true;
}
