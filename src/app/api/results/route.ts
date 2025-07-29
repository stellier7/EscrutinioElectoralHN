import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ApiResponse } from '@/types';

// Force dynamic rendering to avoid SSG issues
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get all escrutinios with their votes
    const escrutinios = await prisma.escrutinio.findMany({
      where: {
        isCompleted: true,
      },
      include: {
        votes: {
          include: {
            candidate: true,
          },
        },
        mesa: true,
        election: true,
      },
    });

    // Group by election level
    const results: Record<string, {
      level: string;
      totalMesas: number;
      completedMesas: number;
      totalVotes: number;
      candidates: Array<{
        name: string;
        party: string;
        votes: number;
        percentage: number;
      }>;
    }> = {
      PRESIDENTIAL: {
        level: 'Presidencial',
        totalMesas: 5,
        completedMesas: escrutinios.filter((e: any) => e.electionLevel === 'PRESIDENTIAL').length,
        totalVotes: 0,
        candidates: [],
      },
      LEGISLATIVE: {
        level: 'Legislativo',
        totalMesas: 5,
        completedMesas: escrutinios.filter((e: any) => e.electionLevel === 'LEGISLATIVE').length,
        totalVotes: 0,
        candidates: [],
      },
      MUNICIPAL: {
        level: 'Municipal',
        totalMesas: 5,
        completedMesas: escrutinios.filter((e: any) => e.electionLevel === 'MUNICIPAL').length,
        totalVotes: 0,
        candidates: [],
      },
    };

    // Process votes for each level
    Object.keys(results).forEach(level => {
      const levelEscrutinios = escrutinios.filter((e: any) => e.electionLevel === level);
      const candidateVotes: Record<string, { name: string; party: string; votes: number }> = {};

      levelEscrutinios.forEach((escrutinio: any) => {
        escrutinio.votes.forEach((vote: any) => {
          const candidateId = vote.candidate.id;
          if (!candidateVotes[candidateId]) {
            candidateVotes[candidateId] = {
              name: vote.candidate.name,
              party: vote.candidate.party,
              votes: 0,
            };
          }
          candidateVotes[candidateId].votes += vote.votes;
        });
      });

      const totalVotes = Object.values(candidateVotes).reduce((sum, candidate) => sum + candidate.votes, 0);
      
      results[level as keyof typeof results].totalVotes = totalVotes;
      results[level as keyof typeof results].candidates = Object.values(candidateVotes).map(candidate => ({
        ...candidate,
        percentage: totalVotes > 0 ? (candidate.votes / totalVotes) * 100 : 0,
      }));
    });

    return NextResponse.json({
      success: true,
      data: results,
      message: 'Resultados obtenidos exitosamente',
    } as ApiResponse);

  } catch (error) {
    console.error('Error fetching results:', error);
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor',
    } as ApiResponse, { status: 500 });
  }
} 