/**
 * Excel 파일 처리 유틸리티
 * xlsx 라이브러리를 동적으로 로드하여 Excel 파일을 읽고 쓸 수 있는 함수들을 제공합니다.
 * 관리자 기능에서만 사용되므로 dynamic import로 번들 크기 최적화
 */

/**
 * 데이터를 Excel 파일로 변환하여 Buffer 반환
 * @param sheets 시트별 데이터 (시트명: 데이터 배열)
 * @returns Excel 파일 Buffer
 */
export async function exportToExcel<T extends Record<string, unknown> = Record<string, unknown>>(
  sheets: Record<string, T[]>
): Promise<Buffer> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  // 각 시트를 워크북에 추가
  for (const [sheetName, data] of Object.entries(sheets)) {
    if (data.length === 0) {
      // 빈 시트도 생성 (헤더만)
      const worksheet = XLSX.utils.aoa_to_sheet([[]]);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    } else {
      // 데이터가 있는 경우
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }
  }

  // Excel 파일을 Buffer로 변환
  const excelBuffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  return excelBuffer;
}

/**
 * Excel 파일을 파싱하여 데이터 추출
 * @param fileBuffer Excel 파일 Buffer
 * @returns 시트별 데이터 (시트명: 데이터 배열)
 */
export async function parseExcelFile<T extends Record<string, unknown> = Record<string, unknown>>(
  fileBuffer: Buffer
): Promise<Record<string, T[]>> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const result: Record<string, T[]> = {};

  // 각 시트를 순회하며 데이터 추출
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<T>(worksheet, {
      raw: false, // 날짜 등을 문자열로 변환
      defval: null, // 빈 셀은 null로 처리
    });
    result[sheetName] = data;
  }

  return result;
}

/**
 * Excel 파일 검증
 * @param fileBuffer Excel 파일 Buffer
 * @param requiredSheets 필수 시트명 배열
 * @returns 검증 결과
 */
export async function validateExcelFile(
  fileBuffer: Buffer,
  requiredSheets: string[] = []
): Promise<{ valid: boolean; error?: string }> {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });

    // 필수 시트 확인
    if (requiredSheets.length > 0) {
      const missingSheets = requiredSheets.filter(
        (sheet) => !workbook.SheetNames.includes(sheet)
      );
      if (missingSheets.length > 0) {
        return {
          valid: false,
          error: `필수 시트가 없습니다: ${missingSheets.join(", ")}`,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Excel 파일을 읽을 수 없습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
    };
  }
}

/**
 * 빈 양식 Excel 파일 생성
 * @param sheets 시트별 헤더 정보 (시트명: 헤더 배열)
 * @returns Excel 파일 Buffer
 */
export async function generateTemplateExcel(
  sheets: Record<string, string[]>
): Promise<Buffer> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  // 각 시트를 워크북에 추가 (헤더만)
  for (const [sheetName, headers] of Object.entries(sheets)) {
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  // Excel 파일을 Buffer로 변환
  const excelBuffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  return excelBuffer;
}

/**
 * 데이터 배열을 Excel 시트 형식으로 변환 (헤더 포함)
 * @param data 데이터 배열
 * @param headers 헤더 배열 (선택사항, 없으면 객체 키 사용)
 * @returns Excel 시트 데이터
 */
export function convertDataToSheet<T extends Record<string, unknown>>(
  data: T[],
  headers?: string[]
): (string | number | boolean | null)[][] {
  if (data.length === 0) {
    return headers ? [headers] : [];
  }

  // 헤더 결정
  const firstItem = data[0];
  if (!firstItem) {
    return headers ? [headers] : [];
  }
  const sheetHeaders = headers || Object.keys(firstItem);

  // 헤더 행
  const rows: (string | number | boolean | null)[][] = [sheetHeaders];

  // 데이터 행
  for (const row of data) {
    const values = sheetHeaders.map((header) => {
      const value = row[header];
      // null, undefined는 빈 문자열로 변환
      if (value === null || value === undefined) {
        return "";
      }
      // 날짜 객체는 ISO 문자열로 변환
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    });
    rows.push(values as (string | number | boolean | null)[]);
  }

  return rows;
}

/**
 * Excel 파일에서 FormData로 변환
 * @param fileBuffer Excel 파일 Buffer
 * @returns FormData (file 필드에 Blob 포함)
 */
export function excelBufferToFormData(fileBuffer: Buffer): FormData {
  const formData = new FormData();
  // Buffer를 Uint8Array로 변환하여 Blob에 전달
  const blob = new Blob([new Uint8Array(fileBuffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  formData.append("file", blob, "upload.xlsx");
  return formData;
}

