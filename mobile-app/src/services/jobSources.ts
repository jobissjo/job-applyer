export const jobSources = [
  { value: "technopark", label: "Technopark", location: "Trivandrum" },
  { value: "infopark", label: "Infopark", location: "Kochi" },
  { value: "cyberpark", label: "Cyberpark", location: "Kozhikode" },
  { value: "ulcyberpark", label: "UL CyberPark", location: "Kozhikode" },
  { value: "smartcity", label: "SmartCity", location: "Kochi" },
];

export const jobSourceLabel = (source: string) =>
  jobSources.find((item) => item.value === source)?.label ||
  (source === "manual" ? "Manual entry" : source);
