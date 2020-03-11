<?php

namespace App\Http\Resources;

class Author extends BaseResource
{
    /**
     * Transform the resource into an array.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    public function toArray($request)
    {
        $attributes = parent::toArray($request);

        $attributes += [
            'links' => [
                'self' => route('authors.show', $this->id),
            ],
        ];

        return $attributes;
    }
}