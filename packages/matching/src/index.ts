import type { DuplicateMatcher, IncidentRouter } from '@civicmerge/contracts';

export const mockMatcher: DuplicateMatcher = {
  async findCandidates({ analysis, incidents }) {
    // TODO: mock — member 4 adds distance filtering and feature scoring.
    return incidents.filter(i => i.type === analysis.type && i.location !== null).map(i => ({
      incidentId: i.id, score: 0.92, distanceMeters: 12,
      reasons: ['Cùng loại sự cố', 'Ứng viên giả lập; khoảng cách và điểm chưa được tính thực tế'],
    }));
  },
};

export const ruleRouter: IncidentRouter = {
  assignTeam(type) {
    return { pothole: 'Tổ đường bộ (thí điểm)', trash: 'Tổ vệ sinh (thí điểm)', flood: 'Tổ thoát nước (thí điểm)' }[type];
  },
};
