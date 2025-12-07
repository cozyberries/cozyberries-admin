export interface RatingBase {
    user_id: string;
    product_id: string;
    rating: number;
    comment?: string;
    images?: string[];
}

export interface Rating extends RatingBase {
    id: string;
    created_at: string;
}

export interface RatingCreate extends Omit<RatingBase, "id"> { }
