export type ExpiredProject = {
  id: string;
  subdomain: string;
  path: string;
  date_expire: Date | null;
  User: {
    id: string;
    email: string;
    name: string;
  };
};