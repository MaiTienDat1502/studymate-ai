import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Giả lập tầng API để test không gọi backend hay Gemini thật
vi.mock('../services/api.js', () => ({
  aiApi: {
    ask: vi.fn(),
    summarize: vi.fn(),
    quiz: vi.fn(),
  },
  historyApi: {
    create: vi.fn(),
  },
}));

import { aiApi, historyApi } from '../services/api.js';
import SummarizePage from '../pages/SummarizePage.jsx';
import QuizPage from '../pages/QuizPage.jsx';

beforeEach(() => {
  vi.resetAllMocks();
  historyApi.create.mockResolvedValue({});
});

describe('SummarizePage: kiểm tra đầu vào', () => {
  it('1. Nội dung chỉ có khoảng trắng thì báo lỗi và không gọi API', async () => {
    render(<SummarizePage />);

    fireEvent.change(screen.getByLabelText(/Nội dung văn bản cần tóm tắt/), {
      target: { value: '     ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bản tóm tắt' }));

    expect(
      await screen.findByText('Vui lòng dán hoặc nhập nội dung văn bản cần tóm tắt.')
    ).toBeInTheDocument();
    expect(aiApi.summarize).not.toHaveBeenCalled();
  });

  it('2. Nội dung hợp lệ được cắt khoảng trắng và gửi với mức medium mặc định', async () => {
    aiApi.summarize.mockResolvedValue({ summary: 'Bản tóm tắt thử' });
    render(<SummarizePage />);

    fireEvent.change(screen.getByLabelText(/Nội dung văn bản cần tóm tắt/), {
      target: { value: '   Nội dung bài học   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bản tóm tắt' }));

    expect(await screen.findByText('Bản tóm tắt thử')).toBeInTheDocument();
    expect(aiApi.summarize).toHaveBeenCalledTimes(1);
    expect(aiApi.summarize).toHaveBeenCalledWith('Nội dung bài học', 'medium');
  });

  it('3. Chọn mức "Ngắn gọn" thì gửi length là short', async () => {
    aiApi.summarize.mockResolvedValue({ summary: 'Tóm tắt ngắn' });
    render(<SummarizePage />);

    fireEvent.change(screen.getByLabelText(/Nội dung văn bản cần tóm tắt/), {
      target: { value: 'Nội dung bài học' },
    });
    fireEvent.click(screen.getByText('Ngắn gọn'));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bản tóm tắt' }));

    await waitFor(() => expect(aiApi.summarize).toHaveBeenCalledTimes(1));
    expect(aiApi.summarize).toHaveBeenCalledWith('Nội dung bài học', 'short');
  });

  it('4. API ném lỗi thì hiển thị đúng thông báo lỗi', async () => {
    aiApi.summarize.mockRejectedValue(new Error('Lỗi giả lập từ máy chủ'));
    render(<SummarizePage />);

    fireEvent.change(screen.getByLabelText(/Nội dung văn bản cần tóm tắt/), {
      target: { value: 'Nội dung bài học' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bản tóm tắt' }));

    expect(await screen.findByText('Lỗi giả lập từ máy chủ')).toBeInTheDocument();
  });
});

describe('QuizPage: kiểm tra đầu vào', () => {
  it('5. Chủ đề chỉ có khoảng trắng thì báo lỗi và không gọi API', async () => {
    render(<QuizPage />);

    fireEvent.change(screen.getByLabelText(/Chủ đề môn học/), {
      target: { value: '    ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bộ trắc nghiệm' }));

    expect(
      await screen.findByText('Vui lòng nhập chủ đề ôn tập cần tạo câu hỏi trắc nghiệm.')
    ).toBeInTheDocument();
    expect(aiApi.quiz).not.toHaveBeenCalled();
  });

  it('6. Chủ đề hợp lệ được cắt khoảng trắng và số câu hỏi được gửi dạng số', async () => {
    aiApi.quiz.mockResolvedValue({
      questions: [
        {
          id: 1,
          question: 'Câu hỏi thử?',
          options: ['A1', 'B1', 'C1', 'D1'],
          answerIndex: 0,
          explanation: 'Giải thích thử',
        },
      ],
    });
    render(<QuizPage />);

    fireEvent.change(screen.getByLabelText(/Chủ đề môn học/), {
      target: { value: '  SQL Indexing  ' },
    });
    fireEvent.change(screen.getByLabelText(/Số lượng câu hỏi/), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bộ trắc nghiệm' }));

    expect(await screen.findByText('Câu hỏi thử?')).toBeInTheDocument();
    expect(aiApi.quiz).toHaveBeenCalledTimes(1);
    // Số 5 (kiểu number), không phải chuỗi '5'
    expect(aiApi.quiz).toHaveBeenCalledWith('SQL Indexing', 5);
  });

  it('7. API trả về dữ liệu thiếu "questions" thì báo lỗi cấu trúc', async () => {
    aiApi.quiz.mockResolvedValue({});
    render(<QuizPage />);

    fireEvent.change(screen.getByLabelText(/Chủ đề môn học/), {
      target: { value: 'Kiến trúc MVC' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bộ trắc nghiệm' }));

    expect(
      await screen.findByText('Dữ liệu bộ đề trắc nghiệm trả về không đúng cấu trúc yêu cầu.')
    ).toBeInTheDocument();
  });

  it('8. API trả về danh sách câu hỏi rỗng thì báo lỗi cấu trúc', async () => {
    aiApi.quiz.mockResolvedValue({ questions: [] });
    render(<QuizPage />);

    fireEvent.change(screen.getByLabelText(/Chủ đề môn học/), {
      target: { value: 'Kiến trúc MVC' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bộ trắc nghiệm' }));

    expect(
      await screen.findByText('Dữ liệu bộ đề trắc nghiệm trả về không đúng cấu trúc yêu cầu.')
    ).toBeInTheDocument();
  });
});