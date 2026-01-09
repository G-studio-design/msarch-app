
// src/lib/report-generator.ts
'use server';

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableCell,
  TableRow,
  WidthType,
  BorderStyle,
  VerticalAlign,
  AlignmentType,
  ImageRun,
  ShadingType,
  PageNumber,
  Header,
  Footer,
  SectionType,
  UnderlineType,
} from 'docx';
import type { Project } from '@/types/project-types';
import type { Language } from '@/context/LanguageContext';
import { getDictionary } from '@/lib/translations';
import { format, parseISO } from 'date-fns';
import { id as IndonesianLocale, enUS as EnglishLocale } from 'date-fns/locale';

// Fungsi untuk memastikan teks tidak null/undefined dan tidak kosong setelah di-trim
// Jika kosong, kembalikan spasi non-breaking (\u00A0) agar TextRun tidak error
const ensureNonEmpty = (text: string | null | undefined, defaultText = '\u00A0'): string => {
  if (text === null || text === undefined) {
    return defaultText;
  }
  const trimmedText = String(text).trim();
  return trimmedText === '' ? defaultText : String(text);
};

const formatDateOnlyForWord = (timestamp: string | undefined | null, lang: Language): string => {
  if (!timestamp) return ensureNonEmpty(null);
  try {
    const locale = lang === 'id' ? IndonesianLocale : EnglishLocale;
    return format(parseISO(timestamp), 'PP', { locale });
  } catch (e) {
    console.error("Error formatting date for Word:", timestamp, e);
    return ensureNonEmpty("Invalid Date");
  }
};

const getLastActivityDateForWord = (project: Project, lang: Language): string => {
  if (!project.workflowHistory || project.workflowHistory.length === 0) {
    return formatDateOnlyForWord(project.createdAt, lang);
  }
  const lastEntry = project.workflowHistory.reduce((latest, entry) => {
    return new Date(entry.timestamp) > new Date(latest.timestamp) ? entry : latest;
  });
  return formatDateOnlyForWord(lastEntry.timestamp, lang);
};

const getContributorsForWord = (project: Project, lang: Language): string => {
  const translations = getDictionary(lang);
  if (!project.files || project.files.length === 0) {
    return ensureNonEmpty(translations.monthlyReportPage.none);
  }
  const contributors = [...new Set(project.files.map(f => f.uploadedBy || 'Unknown'))];
  return ensureNonEmpty(contributors.join(', '));
};

export async function generateWordReport({
  reportData,
  monthName,
  year,
  language,
  chartImageDataUrl,
}: {
  reportData: { completed: Project[]; inProgress: Project[]; canceled: Project[]; };
  monthName: string;
  year: string;
  language: Language;
  chartImageDataUrl: string | null;
}): Promise<Buffer> {
  
  const translations = getDictionary(language);
  const currentLocale = language === 'id' ? IndonesianLocale : EnglishLocale;

  const childrenForSection: (Paragraph | Table)[] = [];

  // Judul Laporan
  childrenForSection.push(
    new Paragraph({
      children: [new TextRun({ text: ensureNonEmpty(`${translations.monthlyReportPage.reportFor} ${monthName} ${year}`), size: 44, bold: true, color: "2C3E50" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300, before: 200 },
    })
  );
  childrenForSection.push(
    new Paragraph({
      children: [new TextRun({ text: ensureNonEmpty(translations.monthlyReportPage.generatedOn + ": " + format(new Date(), 'PPpp', { locale: currentLocale })), size: 24, color: "7F8C8D", italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Ringkasan
  childrenForSection.push(
    new Paragraph({
      children: [new TextRun({ text: ensureNonEmpty(translations.monthlyReportPage.summaryTitle), size: 28, bold: true, color: "34495E" })],
      spacing: { before: 400, after: 150 },
      border: { bottom: { color: "BDC3C7", style: BorderStyle.SINGLE, size: 6 } },
    })
  );
  childrenForSection.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: ensureNonEmpty(`${translations.monthlyReportPage.inProgressProjectsShort}: ${reportData.inProgress.length}`), size: 22 })], spacing: { after: 100, line: 360 } }));
  childrenForSection.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: ensureNonEmpty(`${translations.monthlyReportPage.completedProjectsShort}: ${reportData.completed.length}`), size: 22 })], spacing: { after: 100, line: 360 } }));
  childrenForSection.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: ensureNonEmpty(`${translations.monthlyReportPage.canceledProjectsShort}: ${reportData.canceled.length}`), size: 22 })], spacing: { after: 100, line: 360 } }));
  childrenForSection.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: ensureNonEmpty(`${translations.monthlyReportPage.totalProjects}: ${reportData.inProgress.length + reportData.completed.length + reportData.canceled.length}`), size: 22 })], spacing: { after: 100, line: 360 } }));
  childrenForSection.push(new Paragraph({ children: [new TextRun(ensureNonEmpty(null, " "))], spacing: { after: 200 } })); // Spacing

  // Gambar Grafik (jika ada)
  if (chartImageDataUrl && typeof chartImageDataUrl === 'string' && chartImageDataUrl.startsWith('data:image/')) {
    try {
      childrenForSection.push(
        new Paragraph({
          children: [new TextRun({ text: ensureNonEmpty(translations.monthlyReportPage.chartTitleWord), size: 28, bold: true, color: "34495E" })],
          spacing: { before: 400, after: 150 },
          border: { bottom: { color: "BDC3C7", style: BorderStyle.SINGLE, size: 6 } },
        })
      );
      const imageBuffer = Buffer.from(chartImageDataUrl.split(',')[1], 'base64');
      childrenForSection.push(
        new Paragraph({
          children: [new ImageRun({ data: imageBuffer, transformation: { width: 550, height: 330 } })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        })
      );
    } catch (imgError) {
      console.error("Error processing chart image for Word:", imgError);
      childrenForSection.push(new Paragraph({ children: [new TextRun({ text: ensureNonEmpty("(Gagal memproses gambar grafik)"), size: 22, italics: true })], spacing: { after: 200 } }));
    }
  } else {
     // Bagian ini sengaja dikosongkan jika tidak ada chartImageDataUrl yang valid
  }


  // Tabel Proyek
  childrenForSection.push(
    new Paragraph({
      children: [new TextRun({ text: ensureNonEmpty(translations.monthlyReportPage.tableCaptionWord), size: 28, bold: true, color: "34495E" })],
      spacing: { before: 400, after: 150 },
      border: { bottom: { color: "BDC3C7", style: BorderStyle.SINGLE, size: 6 } },
    })
  );

  const tableHeaderCells = [
    new TableCell({ shading: { type: ShadingType.SOLID, color: "5DADE2", fill: "5DADE2" }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: ensureNonEmpty(translations.monthlyReportPage.tableHeaderTitle), color: "FFFFFF", bold: true, size: 20 })] })] }),
    new TableCell({ shading: { type: ShadingType.SOLID, color: "5DADE2", fill: "5DADE2" }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: ensureNonEmpty(translations.monthlyReportPage.tableHeaderStatus), color: "FFFFFF", bold: true, size: 20 })] })] }),
    new TableCell({ shading: { type: ShadingType.SOLID, color: "5DADE2", fill: "5DADE2" }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: ensureNonEmpty(translations.monthlyReportPage.tableHeaderLastActivityDate), color: "FFFFFF", bold: true, size: 20 })] })] }),
    new TableCell({ shading: { type: ShadingType.SOLID, color: "5DADE2", fill: "5DADE2" }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: ensureNonEmpty(translations.monthlyReportPage.tableHeaderContributors), color: "FFFFFF", bold: true, size: 20 })] })] }),
    new TableCell({ shading: { type: ShadingType.SOLID, color: "5DADE2", fill: "5DADE2" }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: ensureNonEmpty(translations.monthlyReportPage.tableHeaderProgress), color: "FFFFFF", bold: true, size: 20 })] })] }),
    new TableCell({ shading: { type: ShadingType.SOLID, color: "5DADE2", fill: "5DADE2" }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: ensureNonEmpty(translations.monthlyReportPage.tableHeaderCreatedBy), color: "FFFFFF", bold: true, size: 20 })] })] }),
    new TableCell({ shading: { type: ShadingType.SOLID, color: "5DADE2", fill: "5DADE2" }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: ensureNonEmpty(translations.monthlyReportPage.tableHeaderCreatedAt), color: "FFFFFF", bold: true, size: 20 })] })] }),
  ];

  const allProjectsForWord = [...reportData.inProgress, ...reportData.completed, ...reportData.canceled];
  allProjectsForWord.sort((a, b) => {
    const statusOrderValue = (project: Project) => {
      const statusKey = project.status.toLowerCase().replace(/ /g, '') as keyof typeof translations.dashboardPage.status;
      const translatedStatus = translations.dashboardPage.status[statusKey] || project.status;
      if (translatedStatus === translations.dashboardPage.status.inprogress) return 0;
      if (translatedStatus === translations.dashboardPage.status.completed) return 1;
      if (translatedStatus === translations.dashboardPage.status.canceled) return 2;
      return 3;
    };
    const orderA = statusOrderValue(a);
    const orderB = statusOrderValue(b);
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const dataRows = allProjectsForWord.map((project, index) => {
    let statusText = ensureNonEmpty(translations.dashboardPage.status[project.status.toLowerCase().replace(/ /g, '') as keyof typeof translations.dashboardPage.status] || project.status);
    let statusColor = "333333"; // Default dark gray

    if (project.status.toLowerCase() === 'completed') {
      statusColor = "27AE60"; // Green
    } else if (project.status.toLowerCase() === 'inprogress' || project.status.toLowerCase() === 'sedang berjalan') {
      statusColor = "2980B9"; // Blue
    } else if (project.status.toLowerCase() === 'canceled' || project.status.toLowerCase() === 'dibatalkan') {
      statusColor = "C0392B"; // Red
    }

    const rowShading = index % 2 === 0 ? { type: ShadingType.SOLID, color: "EBF5FB", fill: "EBF5FB" } : undefined;

    return new TableRow({
      children: [
        new TableCell({ shading: rowShading, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: ensureNonEmpty(project.title), size: 20, color: "333333" })] })] }),
        new TableCell({ shading: rowShading, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: statusText, color: statusColor, size: 20 })] })] }),
        new TableCell({ shading: rowShading, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: ensureNonEmpty(getLastActivityDateForWord(project, language)), size: 20, color: "333333" })] })] }),
        new TableCell({ shading: rowShading, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: ensureNonEmpty(getContributorsForWord(project, language)), size: 20, color: "333333" })] })] }),
        new TableCell({ shading: rowShading, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: ensureNonEmpty(project.progress.toString() + "%"), size: 20, color: "333333" })] })] }),
        new TableCell({ shading: rowShading, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: ensureNonEmpty(project.createdBy), size: 20, color: "333333" })] })] }),
        new TableCell({ shading: rowShading, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: ensureNonEmpty(formatDateOnlyForWord(project.createdAt, language)), size: 20, color: "333333" })] })] }),
      ],
    });
  });

  if (allProjectsForWord.length > 0) {
    childrenForSection.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: tableHeaderCells, tableHeader: true }), ...dataRows],
        columnWidths: [2500, 1500, 1500, 1800, 800, 1200, 1200], // Adjusted column widths
        borders: {
          top: { style: BorderStyle.SINGLE, size: 6, color: "BFBFBF" },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: "BFBFBF" },
          left: { style: BorderStyle.SINGLE, size: 6, color: "BFBFBF" },
          right: { style: BorderStyle.SINGLE, size: 6, color: "BFBFBF" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" },
        },
      })
    );
  } else {
    childrenForSection.push(new Paragraph({ children: [new TextRun({ text: ensureNonEmpty(translations.monthlyReportPage.noDataForMonth), size: 22, italics: true })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
  }

  childrenForSection.push(new Paragraph({ children: [new TextRun(ensureNonEmpty(null, " "))], spacing: { before: 400 } })); // Spacing

  const doc = new Document({
    // TIDAK ADA properti 'styles' di sini untuk sementara
    creator: ensureNonEmpty("Msarch App"),
    title: ensureNonEmpty(`${translations.monthlyReportPage.reportFor} ${monthName} ${year}`),
    description: ensureNonEmpty(translations.monthlyReportPage.description),
    sections: [{
      properties: {
        page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
        type: SectionType.NEXT_PAGE,
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: ensureNonEmpty("Msarch App - " + translations.monthlyReportPage.title), size: 18, color: "7F8C8D", italics: true }),
              ],
              alignment: AlignmentType.RIGHT,
              spacing: { after: 200 },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: ensureNonEmpty(translations.monthlyReportPage.page) + " ", size: 16, color: "888888" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888" }),
                new TextRun({ text: " " + ensureNonEmpty(translations.monthlyReportPage.of) + " ", size: 16, color: "888888" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "888888" }),
              ],
            }),
          ],
        }),
      },
      children: childrenForSection,
    }],
  });

  try {
    const buffer = await Packer.toBuffer(doc);
    console.log("[generateWordReport] Word document packed successfully.");
    return buffer;
  } catch (error: any) {
    console.error("[generateWordReport] Critical error during Word document generation:", error.message, error.stack);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate Word document: ${errorMessage}`);
  }
}
