import axios from "./axios";

export interface DecodioLogUploadResponse {
  status: string;
  total_records: number;
  records: any[];
}

export const uploadDecodioLog = async (file: File): Promise<DecodioLogUploadResponse> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axios.post<DecodioLogUploadResponse>("/decodio/upload-log", formData, {
  });

  return response.data;
};